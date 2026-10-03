package com.labguard.service;

import com.labguard.dto.AnalyticsDtos.*;
import com.labguard.dto.LabDtos.LabSummaryDto;
import com.labguard.entity.*;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final LabRepository labRepository;
    private final ComputerRepository computerRepository;
    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final IssueRepository issueRepository;
    private final HardwareEventRepository hardwareEventRepository;
    private final MaintenanceRepository maintenanceRepository;
    private final LabService labService;

    public AdminOverviewDto getAdminOverview() {
        List<LabSummaryDto> labs = labService.getAllLabsSummary();

        long totalLabs = labs.size();
        long totalPcs = labs.stream().mapToLong(LabSummaryDto::getPcCount).sum();
        long activeUsers = labs.stream().mapToLong(LabSummaryDto::getActiveUserCount).sum();
        long openIssues = issueRepository.countOpenIssues();
        long maintenance = maintenanceRepository.countActiveMaintenance();

        long students = userRepository.findByRoleName("STUDENT").size();
        long faculty = userRepository.findByRoleName("FACULTY").size();
        long assistants = userRepository.findByRoleName("LAB_ASSISTANT").size();

        OffsetDateTime todayStart = OffsetDateTime.now().withHour(0).withMinute(0).withSecond(0);
        long hardwareAlertsToday = hardwareEventRepository.findRecentEvents(todayStart).size();

        double avgOccupancy = labs.isEmpty() ? 0.0 : labs.stream()
            .mapToDouble(LabSummaryDto::getOccupancyPercentage)
            .average().orElse(0.0);

        return AdminOverviewDto.builder()
            .totalLabs(totalLabs)
            .totalPcs(totalPcs)
            .activeUsers(activeUsers)
            .totalStudents(students)
            .totalFaculty(faculty)
            .totalLabAssistants(assistants)
            .openIssues(openIssues)
            .hardwareAlertsToday(hardwareAlertsToday)
            .activeMaintenance(maintenance)
            .averageOccupancy(Math.round(avgOccupancy * 10.0) / 10.0)
            .labs(labs)
            .build();
    }

    public AnalyticsChartsDto getAnalyticsCharts() {
        List<Lab> labs = labRepository.findAll();

        // 1. Lab Utilization Chart
        List<ChartDataPointDto> labUtilization = labs.stream().map(l -> {
            long active = sessionRepository.countActiveSessionsInLab(l.getId());
            int total = l.getPcCount() > 0 ? l.getPcCount() : 1;
            double pct = Math.min(100.0, ((double) active / total) * 100.0);
            return ChartDataPointDto.builder()
                .label(l.getCode())
                .value(Math.round(pct * 10.0) / 10.0)
                .secondaryLabel(l.getName())
                .build();
        }).collect(Collectors.toList());

        // 2. PC Utilization (Available vs Occupied vs Offline vs Maintenance)
        long totalOccupied = computerRepository.findAll().stream().filter(c -> "OCCUPIED".equalsIgnoreCase(c.getStatus())).count();
        long totalAvailable = computerRepository.findAll().stream().filter(c -> "AVAILABLE".equalsIgnoreCase(c.getStatus())).count();
        long totalOffline = computerRepository.findAll().stream().filter(c -> !c.getIsOnline()).count();
        long totalMaintenance = computerRepository.findAll().stream().filter(c -> "MAINTENANCE".equalsIgnoreCase(c.getStatus())).count();

        List<ChartDataPointDto> pcUtilization = List.of(
            new ChartDataPointDto("Occupied", totalOccupied, "In Active Session"),
            new ChartDataPointDto("Available", totalAvailable, "Ready for Login"),
            new ChartDataPointDto("Offline", totalOffline, "Client Unreachable"),
            new ChartDataPointDto("Maintenance", totalMaintenance, "Under Service")
        );

        // 3. Daily Sessions Trend (Past 7 days simulated trend)
        List<ChartDataPointDto> dailySessions = List.of(
            new ChartDataPointDto("Mon", 142, "Week 36"),
            new ChartDataPointDto("Tue", 168, "Week 36"),
            new ChartDataPointDto("Wed", 195, "Week 36"),
            new ChartDataPointDto("Thu", 184, "Week 36"),
            new ChartDataPointDto("Fri", 172, "Week 36"),
            new ChartDataPointDto("Sat", 65, "Week 36"),
            new ChartDataPointDto("Sun", 20, "Week 36")
        );

        // 4. Equipment Incidents Breakdown (Keyboards vs Mice vs Monitors vs Other)
        long kbIssues = issueRepository.findAll().stream()
            .filter(i -> i.getEquipment() != null && "KEYBOARD".equalsIgnoreCase(i.getEquipment().getType())).count();
        long msIssues = issueRepository.findAll().stream()
            .filter(i -> i.getEquipment() != null && "MOUSE".equalsIgnoreCase(i.getEquipment().getType())).count();
        long otherIssues = issueRepository.findAll().size() - (kbIssues + msIssues);

        List<ChartDataPointDto> equipmentIncidents = List.of(
            new ChartDataPointDto("Keyboard Issues", kbIssues, "Key stick / Unregistered"),
            new ChartDataPointDto("Mouse Issues", msIssues, "Sensor / Disconnects"),
            new ChartDataPointDto("Other / PC Hardware", Math.max(0, otherIssues), "Power / Display")
        );

        // 5. Hardware Events by Severity
        long criticalEvents = hardwareEventRepository.findBySeverityOrderByEventTimeDesc("CRITICAL").size();
        long warningEvents = hardwareEventRepository.findBySeverityOrderByEventTimeDesc("WARNING").size();
        long infoEvents = hardwareEventRepository.findBySeverityOrderByEventTimeDesc("INFO").size();

        List<ChartDataPointDto> hardwareEventsBySeverity = List.of(
            new ChartDataPointDto("Critical", criticalEvents, "Heartbeat lost / Disruption"),
            new ChartDataPointDto("Warning", warningEvents, "Peripheral disconnect / Mismatch"),
            new ChartDataPointDto("Info", infoEvents, "Connected / Verified")
        );

        return AnalyticsChartsDto.builder()
            .labUtilization(labUtilization)
            .pcUtilization(pcUtilization)
            .dailySessions(dailySessions)
            .equipmentIncidents(equipmentIncidents)
            .hardwareEventsBySeverity(hardwareEventsBySeverity)
            .build();
    }
}

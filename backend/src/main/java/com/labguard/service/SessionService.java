package com.labguard.service;

import com.labguard.dto.SessionDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.exception.SessionConflictException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private final SessionRepository sessionRepository;
    private final ComputerRepository computerRepository;
    private final LabRepository labRepository;
    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final FacultyRepository facultyRepository;
    private final ComputerEquipmentRepository computerEquipmentRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    public List<LabActivityItemDto> getWhoIsInTheLab(UUID labId) {
        return sessionRepository.findActiveSessionsInLab(labId).stream()
            .map(this::toActivityItemDto)
            .collect(Collectors.toList());
    }

    public List<LabActivityItemDto> getWhoLeftTheLab(UUID labId) {
        return sessionRepository.findCompletedSessionsInLab(labId).stream()
            .map(this::toActivityItemDto)
            .collect(Collectors.toList());
    }

    public Optional<SessionDetailDto> getActiveSessionForUser(UUID userId) {
        return sessionRepository.findActiveSessionByUserId(userId).map(this::toDetailDto);
    }

    public List<SessionDetailDto> getSessionHistoryForUser(UUID userId) {
        return sessionRepository.findByUserId(userId).stream()
            .sorted((a, b) -> b.getStartTime().compareTo(a.getStartTime()))
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    public List<SessionDetailDto> getAllSessionsInLab(UUID labId) {
        return sessionRepository.findByLabId(labId).stream()
            .sorted((a, b) -> b.getStartTime().compareTo(a.getStartTime()))
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    @Transactional
    public SessionDetailDto endSession(UUID sessionId, String reason, User actor) {
        Session session = sessionRepository.findById(sessionId)
            .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + sessionId));

        if (!"ACTIVE".equalsIgnoreCase(session.getStatus())) {
            return toDetailDto(session);
        }

        OffsetDateTime now = OffsetDateTime.now();
        session.setEndTime(now);
        session.setStatus(reason != null ? reason : "COMPLETED");

        long minutes = Duration.between(session.getStartTime(), now).toMinutes();
        session.setDurationMinutes((int) Math.max(1, minutes));
        sessionRepository.save(session);

        // Free up the workstation
        Computer computer = session.getComputer();
        computer.setStatus("AVAILABLE");
        computerRepository.save(computer);

        auditLogService.logAction(actor != null ? actor : session.getUser(), "SESSION_ENDED", "Session",
            session.getId().toString(), session.getLab().getId(),
            "Session ended for " + session.getUser().getFullName() + " on " + computer.getPcCode() + " (" + minutes + " min)");

        notificationService.broadcastSystemNotification(
            session.getLab(), computer, "SESSION_ENDED", "INFO",
            "Session completed on " + computer.getPcCode(),
            session.getUser().getFullName() + " logged out from " + computer.getPcCode() + ". Workstation is available."
        );

        return toDetailDto(session);
    }

    public LabOccupancyDto getLabOccupancy(UUID labId) {
        Lab lab = labRepository.findById(labId)
            .orElseThrow(() -> new ResourceNotFoundException("Lab not found: " + labId));

        List<Computer> computers = computerRepository.findByLabId(labId);
        int totalPcs = computers.size();
        int activePcs = (int) computers.stream().filter(c -> "OCCUPIED".equalsIgnoreCase(c.getStatus())).count();
        int availablePcs = (int) computers.stream().filter(c -> "AVAILABLE".equalsIgnoreCase(c.getStatus())).count();
        int offlinePcs = (int) computers.stream().filter(c -> !c.getIsOnline()).count();
        int maintenancePcs = (int) computers.stream().filter(c -> "MAINTENANCE".equalsIgnoreCase(c.getStatus())).count();

        double occupancyRate = totalPcs > 0 ? ((double) activePcs / totalPcs) * 100.0 : 0.0;

        return LabOccupancyDto.builder()
            .labCode(lab.getCode())
            .labName(lab.getName())
            .totalPcs(totalPcs)
            .activePcs(activePcs)
            .availablePcs(availablePcs)
            .offlinePcs(offlinePcs)
            .maintenancePcs(maintenancePcs)
            .occupancyRate(Math.round(occupancyRate * 10.0) / 10.0)
            .build();
    }

    private LabActivityItemDto toActivityItemDto(Session session) {
        String identifier = "";
        if ("STUDENT".equalsIgnoreCase(session.getRole())) {
            identifier = studentRepository.findByUserId(session.getUser().getId())
                .map(Student::getStudentId).orElse("");
        } else if ("FACULTY".equalsIgnoreCase(session.getRole())) {
            identifier = facultyRepository.findByUserId(session.getUser().getId())
                .map(Faculty::getEmployeeId).orElse("");
        }

        String activityStatus = "ACTIVE".equalsIgnoreCase(session.getStatus()) ? "ACTIVE" : "OUT";

        return LabActivityItemDto.builder()
            .sessionId(session.getId())
            .userName(session.getUser().getFullName())
            .userIdentifier(identifier)
            .role(session.getRole())
            .pcCode(session.getComputer().getPcCode())
            .labCode(session.getLab().getCode())
            .entryTime(session.getStartTime())
            .exitTime(session.getEndTime())
            .status(activityStatus)
            .durationMinutes(session.getDurationMinutes())
            .build();
    }

    private SessionDetailDto toDetailDto(Session session) {
        String identifier = "";
        if ("STUDENT".equalsIgnoreCase(session.getRole())) {
            identifier = studentRepository.findByUserId(session.getUser().getId())
                .map(Student::getStudentId).orElse("");
        } else if ("FACULTY".equalsIgnoreCase(session.getRole())) {
            identifier = facultyRepository.findByUserId(session.getUser().getId())
                .map(Faculty::getEmployeeId).orElse("");
        }

        String kbAssetId = computerEquipmentRepository.findActiveByComputerIdAndSlotType(session.getComputer().getId(), "KEYBOARD")
            .map(ce -> ce.getEquipment().getAssetId()).orElse("NONE");
        String msAssetId = computerEquipmentRepository.findActiveByComputerIdAndSlotType(session.getComputer().getId(), "MOUSE")
            .map(ce -> ce.getEquipment().getAssetId()).orElse("NONE");

        return SessionDetailDto.builder()
            .id(session.getId())
            .userId(session.getUser().getId())
            .userFullName(session.getUser().getFullName())
            .userIdentifier(identifier)
            .role(session.getRole())
            .labId(session.getLab().getId())
            .labCode(session.getLab().getCode())
            .labName(session.getLab().getName())
            .computerId(session.getComputer().getId())
            .pcCode(session.getComputer().getPcCode())
            .startTime(session.getStartTime())
            .endTime(session.getEndTime())
            .status(session.getStatus())
            .ipAddress(session.getIpAddress())
            .durationMinutes(session.getDurationMinutes())
            .keyboardAssetId(kbAssetId)
            .mouseAssetId(msAssetId)
            .build();
    }
}

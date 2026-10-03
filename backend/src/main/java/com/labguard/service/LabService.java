package com.labguard.service;

import com.labguard.dto.LabDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LabService {

    private final LabRepository labRepository;
    private final ComputerRepository computerRepository;
    private final SessionRepository sessionRepository;
    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final UserLabAssignmentRepository assignmentRepository;
    private final AuditLogService auditLogService;

    public List<LabSummaryDto> getAllLabsSummary() {
        return labRepository.findAll().stream()
            .map(this::toSummaryDto)
            .collect(Collectors.toList());
    }

    public List<LabSummaryDto> getAssignedLabsForUser(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        if ("ADMIN".equalsIgnoreCase(user.getRole().getName())) {
            return getAllLabsSummary();
        }

        return labRepository.findLabsAssignedToUser(userId).stream()
            .map(this::toSummaryDto)
            .collect(Collectors.toList());
    }

    public LabSummaryDto getLabSummaryById(UUID labId) {
        Lab lab = labRepository.findById(labId)
            .orElseThrow(() -> new ResourceNotFoundException("Laboratory not found: " + labId));
        return toSummaryDto(lab);
    }

    public LabSummaryDto getLabSummaryByCode(String code) {
        Lab lab = labRepository.findByCode(code)
            .orElseThrow(() -> new ResourceNotFoundException("Laboratory not found with code: " + code));
        return toSummaryDto(lab);
    }

    @Transactional
    public LabSummaryDto createLab(CreateLabRequest request, User adminUser) {
        Lab lab = Lab.builder()
            .code(request.getCode().toUpperCase())
            .name(request.getName())
            .room(request.getRoom())
            .description(request.getDescription())
            .status(request.getStatus() != null ? request.getStatus() : "ACTIVE")
            .pcCount(request.getPcCount() != null ? request.getPcCount() : 0)
            .build();
        labRepository.save(lab);

        auditLogService.logAction(adminUser, "LAB_CREATED", "Lab", lab.getId().toString(), lab.getId(),
            "Created lab " + lab.getCode() + " (" + lab.getName() + ")");

        return toSummaryDto(lab);
    }

    @Transactional
    public void assignStaffToLab(AssignStaffRequest request, User adminUser) {
        User staff = userRepository.findById(request.getUserId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + request.getUserId()));
        Lab lab = labRepository.findById(request.getLabId())
            .orElseThrow(() -> new ResourceNotFoundException("Lab not found: " + request.getLabId()));

        UserLabAssignment assignment = UserLabAssignment.builder()
            .user(staff)
            .lab(lab)
            .assignmentType(request.getAssignmentType())
            .assignedFrom(LocalDate.now())
            .status("ACTIVE")
            .build();
        assignmentRepository.save(assignment);

        auditLogService.logAction(adminUser, "ASSIGNMENT_CREATED", "UserLabAssignment",
            assignment.getId().toString(), lab.getId(),
            "Assigned " + staff.getFullName() + " as " + request.getAssignmentType() + " to " + lab.getCode());
    }

    private LabSummaryDto toSummaryDto(Lab lab) {
        long activePcs = computerRepository.countByLabIdAndStatus(lab.getId(), "AVAILABLE") +
                         computerRepository.countByLabIdAndStatus(lab.getId(), "OCCUPIED");
        long offlinePcs = computerRepository.countByLabIdAndIsOnline(lab.getId(), false);
        long activeUsers = sessionRepository.countActiveSessionsInLab(lab.getId());
        long openIssues = issueRepository.countOpenIssuesInLab(lab.getId());

        int totalPcs = lab.getPcCount() > 0 ? lab.getPcCount() : 1;
        double occupancy = Math.min(100.0, ((double) activeUsers / totalPcs) * 100.0);

        return LabSummaryDto.builder()
            .id(lab.getId())
            .code(lab.getCode())
            .name(lab.getName())
            .room(lab.getRoom())
            .description(lab.getDescription())
            .status(lab.getStatus())
            .pcCount(lab.getPcCount())
            .activePcCount(activePcs)
            .offlinePcCount(offlinePcs)
            .activeUserCount(activeUsers)
            .openIssueCount(openIssues)
            .occupancyPercentage(Math.round(occupancy * 10.0) / 10.0)
            .build();
    }
}

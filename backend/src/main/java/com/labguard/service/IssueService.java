package com.labguard.service;

import com.labguard.dto.IssueDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class IssueService {

    private final IssueRepository issueRepository;
    private final IssueEventRepository issueEventRepository;
    private final ComputerRepository computerRepository;
    private final EquipmentRepository equipmentRepository;
    private final LabRepository labRepository;
    private final MaintenanceRepository maintenanceRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    public List<IssueDetailDto> getAllIssues() {
        return issueRepository.findAll().stream()
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    public List<IssueDetailDto> getIssuesByLab(UUID labId) {
        return issueRepository.findByLabIdOrderByCreatedAtDesc(labId).stream()
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    public List<IssueDetailDto> getIssuesReportedByUser(UUID userId) {
        return issueRepository.findByReportedByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    public IssueDetailDto getIssueDetail(UUID issueId) {
        Issue issue = issueRepository.findById(issueId)
            .orElseThrow(() -> new ResourceNotFoundException("Issue ticket not found: " + issueId));
        return toDetailDto(issue);
    }

    @Transactional
    public IssueDetailDto createIssue(CreateIssueRequest request, User reporter) {
        Computer computer = computerRepository.findByLabCodeAndPcCode(request.getLabCode(), request.getPcCode())
            .orElseThrow(() -> new ResourceNotFoundException("Workstation not found: " + request.getPcCode() + " in " + request.getLabCode()));

        Equipment equipment = null;
        if (request.getEquipmentAssetId() != null && !request.getEquipmentAssetId().isBlank()) {
            equipment = equipmentRepository.findByAssetId(request.getEquipmentAssetId()).orElse(null);
        }

        long count = issueRepository.count() + 1043;
        String issueCode = "ISS-" + count;

        Issue issue = Issue.builder()
            .issueCode(issueCode)
            .computer(computer)
            .equipment(equipment)
            .lab(computer.getLab())
            .reportedBy(reporter)
            .issueType(request.getIssueType())
            .title(request.getTitle())
            .description(request.getDescription())
            .photoEvidenceUrl(request.getPhotoEvidenceUrl())
            .status("OPEN")
            .priority(request.getPriority() != null ? request.getPriority() : "MEDIUM")
            .build();

        issueRepository.save(issue);

        // Record initial timeline event
        IssueEvent event = IssueEvent.builder()
            .issue(issue)
            .user(reporter)
            .previousStatus(null)
            .newStatus("OPEN")
            .comment("Ticket submitted by " + reporter.getFullName())
            .actionTaken("Created Issue Ticket")
            .evidenceUrl(request.getPhotoEvidenceUrl())
            .build();
        issueEventRepository.save(event);

        auditLogService.logAction(reporter, "ISSUE_CREATED", "Issue", issue.getId().toString(),
            computer.getLab().getId(), "Created " + issueCode + ": " + issue.getTitle());

        notificationService.dispatchIssueAlert(
            computer.getLab(),
            computer,
            issue,
            "NEW_ISSUE",
            "WARNING",
            "New Issue " + issueCode + " reported",
            reporter.getFullName() + " reported: " + issue.getTitle() + " on " + computer.getPcCode()
        );

        return toDetailDto(issue);
    }

    @Transactional
    public IssueDetailDto updateIssueStatus(UUID issueId, UpdateIssueStatusRequest request, User actor) {
        Issue issue = issueRepository.findById(issueId)
            .orElseThrow(() -> new ResourceNotFoundException("Issue not found: " + issueId));

        String oldStatus = issue.getStatus();
        String newStatus = request.getNewStatus().toUpperCase();

        issue.setStatus(newStatus);
        issueRepository.save(issue);

        // Record timeline event
        IssueEvent event = IssueEvent.builder()
            .issue(issue)
            .user(actor)
            .previousStatus(oldStatus)
            .newStatus(newStatus)
            .comment(request.getComment())
            .actionTaken(request.getActionTaken())
            .evidenceUrl(request.getEvidenceUrl())
            .build();
        issueEventRepository.save(event);

        // If moved to MAINTENANCE, create maintenance ticket if not already present
        if ("MAINTENANCE".equalsIgnoreCase(newStatus)) {
            Maintenance maintenance = Maintenance.builder()
                .issue(issue)
                .computer(issue.getComputer())
                .equipment(issue.getEquipment())
                .technicianName(request.getTechnicianName() != null ? request.getTechnicianName() : actor.getFullName())
                .scheduledDate(LocalDate.now())
                .status("IN_PROGRESS")
                .notes(request.getComment())
                .build();
            maintenanceRepository.save(maintenance);

            issue.getComputer().setStatus("MAINTENANCE");
            computerRepository.save(issue.getComputer());
        } else if ("RESOLVED".equalsIgnoreCase(newStatus)) {
            if ("MAINTENANCE".equalsIgnoreCase(issue.getComputer().getStatus())) {
                issue.getComputer().setStatus("AVAILABLE");
                computerRepository.save(issue.getComputer());
            }
        }

        auditLogService.logAction(actor, "ISSUE_STATUS_CHANGED", "Issue", issue.getId().toString(),
            issue.getLab().getId(), "Status changed from " + oldStatus + " to " + newStatus);

        notificationService.dispatchIssueAlert(
            issue.getLab(),
            issue.getComputer(),
            issue,
            "RESOLVED".equalsIgnoreCase(newStatus) ? "ISSUE_RESOLVED" : "ISSUE_UPDATED",
            "RESOLVED".equalsIgnoreCase(newStatus) ? "INFO" : "WARNING",
            "Issue " + issue.getIssueCode() + " " + newStatus.toLowerCase(),
            actor.getFullName() + " updated status to " + newStatus + ": " + (request.getComment() != null ? request.getComment() : "")
        );

        return toDetailDto(issue);
    }

    private IssueDetailDto toDetailDto(Issue issue) {
        List<IssueEventItemDto> timeline = issueEventRepository.findByIssueIdOrderByCreatedAtAsc(issue.getId()).stream()
            .map(e -> IssueEventItemDto.builder()
                .id(e.getId())
                .userName(e.getUser().getFullName())
                .userRole(e.getUser().getRole().getName())
                .previousStatus(e.getPreviousStatus())
                .newStatus(e.getNewStatus())
                .comment(e.getComment())
                .actionTaken(e.getActionTaken())
                .evidenceUrl(e.getEvidenceUrl())
                .createdAt(e.getCreatedAt())
                .build())
            .collect(Collectors.toList());

        String eqAssetId = issue.getEquipment() != null ? issue.getEquipment().getAssetId() : "NONE";
        String eqType = issue.getEquipment() != null ? issue.getEquipment().getType() : "NONE";

        return IssueDetailDto.builder()
            .id(issue.getId())
            .issueCode(issue.getIssueCode())
            .computerId(issue.getComputer().getId())
            .pcCode(issue.getComputer().getPcCode())
            .equipmentId(issue.getEquipment() != null ? issue.getEquipment().getId() : null)
            .equipmentAssetId(eqAssetId)
            .equipmentType(eqType)
            .labId(issue.getLab().getId())
            .labCode(issue.getLab().getCode())
            .labName(issue.getLab().getName())
            .reportedByUserId(issue.getReportedBy().getId())
            .reportedByUserName(issue.getReportedBy().getFullName())
            .reportedByUserRole(issue.getReportedBy().getRole().getName())
            .issueType(issue.getIssueType())
            .title(issue.getTitle())
            .description(issue.getDescription())
            .photoEvidenceUrl(issue.getPhotoEvidenceUrl())
            .status(issue.getStatus())
            .priority(issue.getPriority())
            .createdAt(issue.getCreatedAt())
            .updatedAt(issue.getUpdatedAt())
            .timeline(timeline)
            .build();
    }
}

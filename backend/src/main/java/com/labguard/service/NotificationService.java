package com.labguard.service;

import com.labguard.config.RealtimeWebSocketHandler;
import com.labguard.dto.NotificationDtos.*;
import com.labguard.entity.*;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final UserRepository userRepository;
    private final UserLabAssignmentRepository assignmentRepository;
    private final LabRepository labRepository;
    private final ComputerRepository computerRepository;
    private final EquipmentRepository equipmentRepository;
    private final IssueRepository issueRepository;
    private final SessionRepository sessionRepository;
    private final RealtimeWebSocketHandler webSocketHandler;

    @Value("${labguard.notifications.dedup-cooldown-seconds:15}")
    private int cooldownSeconds;

    public List<NotificationItemDto> getUserNotifications(UUID userId, String filter) {
        List<Notification> list = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if ("UNREAD".equalsIgnoreCase(filter)) {
            list = list.stream().filter(n -> !n.getIsRead()).collect(Collectors.toList());
        } else if ("CRITICAL".equalsIgnoreCase(filter)) {
            list = list.stream().filter(n -> "CRITICAL".equalsIgnoreCase(n.getSeverity())).collect(Collectors.toList());
        } else if ("WARNING".equalsIgnoreCase(filter)) {
            list = list.stream().filter(n -> "WARNING".equalsIgnoreCase(n.getSeverity())).collect(Collectors.toList());
        } else if ("INFO".equalsIgnoreCase(filter)) {
            list = list.stream().filter(n -> "INFO".equalsIgnoreCase(n.getSeverity())).collect(Collectors.toList());
        }

        return list.stream().map(this::toItemDto).collect(Collectors.toList());
    }

    public NotificationBadgeDto getNotificationBadge(UUID userId) {
        List<Notification> list = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        long critical = list.stream().filter(n -> "CRITICAL".equalsIgnoreCase(n.getSeverity())).count();
        long warning = list.stream().filter(n -> "WARNING".equalsIgnoreCase(n.getSeverity())).count();

        return NotificationBadgeDto.builder()
            .unreadCount(list.size())
            .criticalCount(critical)
            .warningCount(warning)
            .build();
    }

    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getUser().getId().equals(userId)) {
                n.setIsRead(true);
                n.setReadAt(OffsetDateTime.now());
                notificationRepository.save(n);
            }
        });
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsReadForUser(userId);
    }

    /**
     * Dispatches hardware alerts with strict anti-flooding cooldown and role/lab routing.
     */
    @Transactional
    public void dispatchHardwareAlert(Lab lab, Computer pc, Equipment equipment, String eventType, String severity, String title, String message) {
        OffsetDateTime since = OffsetDateTime.now().minusSeconds(cooldownSeconds);

        // 1. Find target recipients:
        // - All Admins
        // - Lab Assistants assigned to this lab
        // - Faculty assigned to this lab
        Set<User> recipients = new HashSet<>();

        recipients.addAll(userRepository.findByRoleName("ADMIN"));

        List<UserLabAssignment> assignments = assignmentRepository.findByLabIdAndStatus(lab.getId(), "ACTIVE");
        for (UserLabAssignment ula : assignments) {
            recipients.add(ula.getUser());
        }

        for (User recipient : recipients) {
            // Anti-flooding check: skip if identical notification was created within cooldown window
            long recentCount = notificationRepository.countRecentSimilarNotifications(recipient.getId(), pc.getId(), eventType, since);
            if (recentCount > 0) {
                log.debug("Anti-flooding suppressed duplicate {} for user {}", eventType, recipient.getEmail());
                continue;
            }

            // Check preferences
            Optional<NotificationPreference> prefOpt = preferenceRepository.findByUserId(recipient.getId());
            if (prefOpt.isPresent() && !prefOpt.get().getHardwareAlerts()) {
                continue;
            }

            Notification notification = Notification.builder()
                .user(recipient)
                .lab(lab)
                .computer(pc)
                .equipment(equipment)
                .eventType(eventType)
                .severity(severity)
                .title(title)
                .message(message)
                .isRead(false)
                .build();
            notificationRepository.save(notification);
        }

        // Broadcast real-time WebSocket event
        String jsonEvent = String.format("{\"type\":\"HARDWARE_ALERT\",\"lab\":\"%s\",\"pc\":\"%s\",\"title\":\"%s\",\"severity\":\"%s\"}",
            lab.getCode(), pc.getPcCode(), title, severity);
        webSocketHandler.broadcastEvent(jsonEvent);
    }

    /**
     * Dispatches issue status and new ticket alerts to lab staff and the student who reported it.
     */
    @Transactional
    public void dispatchIssueAlert(Lab lab, Computer pc, Issue issue, String eventType, String severity, String title, String message) {
        Set<User> recipients = new HashSet<>();
        recipients.addAll(userRepository.findByRoleName("ADMIN"));

        List<UserLabAssignment> assignments = assignmentRepository.findByLabIdAndStatus(lab.getId(), "ACTIVE");
        for (UserLabAssignment ula : assignments) {
            recipients.add(ula.getUser());
        }

        // Add the reporter (e.g. Student) so they receive resolution updates
        recipients.add(issue.getReportedBy());

        for (User recipient : recipients) {
            Notification notification = Notification.builder()
                .user(recipient)
                .lab(lab)
                .computer(pc)
                .equipment(issue.getEquipment())
                .issue(issue)
                .eventType(eventType)
                .severity(severity)
                .title(title)
                .message(message)
                .isRead(false)
                .build();
            notificationRepository.save(notification);
        }

        String jsonEvent = String.format("{\"type\":\"ISSUE_ALERT\",\"lab\":\"%s\",\"issueCode\":\"%s\",\"title\":\"%s\"}",
            lab.getCode(), issue.getIssueCode(), title);
        webSocketHandler.broadcastEvent(jsonEvent);
    }

    @Transactional
    public void broadcastSystemNotification(Lab lab, Computer pc, String eventType, String severity, String title, String message) {
        List<User> admins = userRepository.findByRoleName("ADMIN");
        for (User admin : admins) {
            Notification notification = Notification.builder()
                .user(admin)
                .lab(lab)
                .computer(pc)
                .eventType(eventType)
                .severity(severity)
                .title(title)
                .message(message)
                .isRead(false)
                .build();
            notificationRepository.save(notification);
        }

        String jsonEvent = String.format("{\"type\":\"SYSTEM_ALERT\",\"lab\":\"%s\",\"pc\":\"%s\",\"title\":\"%s\"}",
            lab != null ? lab.getCode() : "ALL", pc != null ? pc.getPcCode() : "N/A", title);
        webSocketHandler.broadcastEvent(jsonEvent);
    }

    @Transactional
    public void createNotification(
        UUID userId,
        UUID labId,
        UUID computerId,
        UUID equipmentId,
        UUID issueId,
        UUID sessionId,
        String eventType,
        String severity,
        String title,
        String message
    ) {
        if (userId == null) return;
        userRepository.findById(userId).ifPresent(recipient -> {
            Lab lab = labId != null ? labRepository.findById(labId).orElse(null) : null;
            Computer pc = computerId != null ? computerRepository.findById(computerId).orElse(null) : null;
            Equipment eq = equipmentId != null ? equipmentRepository.findById(equipmentId).orElse(null) : null;
            Issue iss = issueId != null ? issueRepository.findById(issueId).orElse(null) : null;
            Session sess = sessionId != null ? sessionRepository.findById(sessionId).orElse(null) : null;

            Notification n = Notification.builder()
                .user(recipient)
                .lab(lab)
                .computer(pc)
                .equipment(eq)
                .issue(iss)
                .session(sess)
                .eventType(eventType)
                .severity(severity != null ? severity : "INFO")
                .title(title)
                .message(message)
                .isRead(false)
                .build();
            notificationRepository.save(n);
        });
    }

    public NotificationPreferenceDto getPreferences(UUID userId) {
        NotificationPreference pref = preferenceRepository.findByUserId(userId)
            .orElseGet(() -> NotificationPreference.builder().build());

        return NotificationPreferenceDto.builder()
            .hardwareAlerts(pref.getHardwareAlerts())
            .issueAlerts(pref.getIssueAlerts())
            .maintenanceAlerts(pref.getMaintenanceAlerts())
            .sessionAlerts(pref.getSessionAlerts())
            .systemAlerts(pref.getSystemAlerts())
            .inAppEnabled(pref.getInAppEnabled())
            .browserEnabled(pref.getBrowserEnabled())
            .emailEnabled(pref.getEmailEnabled())
            .build();
    }

    @Transactional
    public void updatePreferences(UUID userId, NotificationPreferenceDto dto) {
        User user = userRepository.findById(userId).orElseThrow();
        NotificationPreference pref = preferenceRepository.findByUserId(userId)
            .orElseGet(() -> NotificationPreference.builder().user(user).build());

        if (dto.getHardwareAlerts() != null) pref.setHardwareAlerts(dto.getHardwareAlerts());
        if (dto.getIssueAlerts() != null) pref.setIssueAlerts(dto.getIssueAlerts());
        if (dto.getMaintenanceAlerts() != null) pref.setMaintenanceAlerts(dto.getMaintenanceAlerts());
        if (dto.getSessionAlerts() != null) pref.setSessionAlerts(dto.getSessionAlerts());
        if (dto.getSystemAlerts() != null) pref.setSystemAlerts(dto.getSystemAlerts());
        if (dto.getInAppEnabled() != null) pref.setInAppEnabled(dto.getInAppEnabled());
        if (dto.getBrowserEnabled() != null) pref.setBrowserEnabled(dto.getBrowserEnabled());
        if (dto.getEmailEnabled() != null) pref.setEmailEnabled(dto.getEmailEnabled());

        preferenceRepository.save(pref);
    }

    private NotificationItemDto toItemDto(Notification n) {
        return NotificationItemDto.builder()
            .id(n.getId())
            .eventType(n.getEventType())
            .severity(n.getSeverity())
            .title(n.getTitle())
            .message(n.getMessage())
            .labCode(n.getLab() != null ? n.getLab().getCode() : "ALL")
            .pcCode(n.getComputer() != null ? n.getComputer().getPcCode() : "N/A")
            .equipmentAssetId(n.getEquipment() != null ? n.getEquipment().getAssetId() : null)
            .issueId(n.getIssue() != null ? n.getIssue().getId() : null)
            .sessionId(n.getSession() != null ? n.getSession().getId() : null)
            .isRead(n.getIsRead())
            .createdAt(n.getCreatedAt())
            .build();
    }
}

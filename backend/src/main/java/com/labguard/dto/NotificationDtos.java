package com.labguard.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

public class NotificationDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NotificationItemDto {
        private UUID id;
        private String eventType;
        private String severity; // INFO, WARNING, CRITICAL
        private String title;
        private String message;
        private String labCode;
        private String pcCode;
        private String equipmentAssetId;
        private UUID issueId;
        private UUID sessionId;
        private Boolean isRead;
        private OffsetDateTime createdAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NotificationBadgeDto {
        private long unreadCount;
        private long criticalCount;
        private long warningCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NotificationPreferenceDto {
        private Boolean hardwareAlerts;
        private Boolean issueAlerts;
        private Boolean maintenanceAlerts;
        private Boolean sessionAlerts;
        private Boolean systemAlerts;
        private Boolean inAppEnabled;
        private Boolean browserEnabled;
        private Boolean emailEnabled;
    }
}

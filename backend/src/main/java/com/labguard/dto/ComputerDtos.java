package com.labguard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

public class ComputerDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ComputerDetailDto {
        private UUID id;
        private UUID labId;
        private String labCode;
        private String labName;
        private String pcCode;
        private String hostname;
        private String ipAddress;
        private String status; // AVAILABLE, OCCUPIED, MAINTENANCE, OFFLINE
        private Boolean isOnline;
        private OffsetDateTime lastHeartbeat;
        private String clientVersion;

        // Assigned Peripherals
        private String keyboardAssetId;
        private String keyboardStatus;
        private String mouseAssetId;
        private String mouseStatus;

        // Current Session info (if occupied)
        private String currentUserFullName;
        private String currentUserRole;
        private OffsetDateTime currentSessionStart;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RegisterPcRequest {
        @NotBlank(message = "Lab code is required")
        private String labCode;

        @NotBlank(message = "PC code is required")
        private String pcCode;

        private String hostname;
        private String ipAddress;
        private String macAddress;
        private String clientVersion;
        private String registrationSecret;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HeartbeatRequest {
        private String labCode;
        private String pcCode;
        private String clientVersion;
        private boolean keyboardConnected;
        private boolean mouseConnected;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HeartbeatResponse {
        private boolean acknowledged;
        private String pcStatus;
        private boolean requiresLock;
        private String message;
    }
}

package com.labguard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

public class HardwareDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HardwareEventDetailDto {
        private UUID id;
        private UUID labId;
        private String labCode;
        private UUID computerId;
        private String pcCode;
        private UUID equipmentId;
        private String equipmentAssetId;
        private String equipmentType;
        private String eventType; // HARDWARE_CONNECTED, HARDWARE_DISCONNECTED, HARDWARE_MISMATCH, CLIENT_OFFLINE, CLIENT_ONLINE
        private String severity; // INFO, WARNING, CRITICAL
        private String description; // Neutral wording
        private OffsetDateTime eventTime;
        private String activeUserEmail;
        private String activeUserRole;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReportHardwareEventRequest {
        @NotBlank(message = "Lab code is required")
        private String labCode;

        @NotBlank(message = "PC code is required")
        private String pcCode;

        private String slotType; // KEYBOARD, MOUSE, USB_DEVICE

        @NotBlank(message = "Event type is required")
        private String eventType; // HARDWARE_CONNECTED, HARDWARE_DISCONNECTED, HARDWARE_MISMATCH

        private String vendorId;
        private String productId;
        private String description;
    }
}

package com.labguard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public class EquipmentDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EquipmentDetailDto {
        private UUID id;
        private String assetId; // KB-017, MS-017
        private String type; // KEYBOARD, MOUSE, MONITOR, HEADSET, OTHER
        private String brand;
        private String model;
        private String serialNumber;
        private String status; // OPERATIONAL, DEFECTIVE, MISSING, UNDER_REPAIR
        private String qrCodeData;
        private LocalDate purchaseDate;
        private LocalDate warrantyUntil;

        // Current PC mapping if assigned
        private UUID assignedPcId;
        private String assignedPcCode;
        private String assignedLabCode;

        // Issue and repair history stats
        private long totalIssueCount;
        private String lastIssueTitle;
        private OffsetDateTime lastIssueDate;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AssignEquipmentRequest {
        @NotBlank(message = "PC ID is required")
        private UUID computerId;

        @NotBlank(message = "Equipment ID is required")
        private UUID equipmentId;

        @NotBlank(message = "Slot type is required")
        private String slotType; // KEYBOARD, MOUSE, PRIMARY_MONITOR
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class QrScanResultDto {
        private String assetId;
        private String type;
        private String brandModel;
        private String assignedLab;
        private String assignedPc;
        private String currentStatus;
        private long issueCount;
        private String lastIssue;
        private String maintenanceHistorySummary;
    }
}

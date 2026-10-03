package com.labguard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class LabDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LabSummaryDto {
        private UUID id;
        private String code;
        private String name;
        private String room;
        private String description;
        private String status;
        private Integer pcCount;
        private long activePcCount;
        private long offlinePcCount;
        private long activeUserCount;
        private long openIssueCount;
        private double occupancyPercentage;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateLabRequest {
        @NotBlank(message = "Lab code is required")
        private String code;

        @NotBlank(message = "Lab name is required")
        private String name;

        @NotBlank(message = "Room number is required")
        private String room;

        private String description;
        private String status;
        private Integer pcCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AssignStaffRequest {
        private UUID userId;
        private UUID labId;
        private String assignmentType; // FACULTY, LAB_ASSISTANT
    }
}

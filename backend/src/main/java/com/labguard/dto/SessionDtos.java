package com.labguard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

public class SessionDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SessionDetailDto {
        private UUID id;
        private UUID userId;
        private String userFullName;
        private String userIdentifier; // Student ID or Faculty Employee ID
        private String role; // STUDENT, FACULTY
        private UUID labId;
        private String labCode;
        private String labName;
        private UUID computerId;
        private String pcCode;
        private OffsetDateTime startTime;
        private OffsetDateTime endTime;
        private String status; // ACTIVE, COMPLETED, CANCELLED, FORCED_END, ERROR
        private String ipAddress;
        private Integer durationMinutes;

        // Peripheral verification at session start
        private String keyboardAssetId;
        private String mouseAssetId;
    }

    // Who is in the lab / Who left the lab view item
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LabActivityItemDto {
        private UUID sessionId;
        private String userName;
        private String userIdentifier;
        private String role;
        private String pcCode;
        private String labCode;
        private OffsetDateTime entryTime;
        private OffsetDateTime exitTime;
        private String status; // ACTIVE, OUT, FORCED_END
        private Integer durationMinutes;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LabOccupancyDto {
        private String labCode;
        private String labName;
        private int totalPcs;
        private int activePcs;
        private int availablePcs;
        private int offlinePcs;
        private int maintenancePcs;
        private double occupancyRate;
    }
}

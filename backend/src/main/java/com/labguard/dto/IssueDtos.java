package com.labguard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class IssueDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class IssueDetailDto {
        private UUID id;
        private String issueCode; // ISS-1042
        private UUID computerId;
        private String pcCode;
        private UUID equipmentId;
        private String equipmentAssetId;
        private String equipmentType;
        private UUID labId;
        private String labCode;
        private String labName;
        private UUID reportedByUserId;
        private String reportedByUserName;
        private String reportedByUserRole;
        private String issueType; // KEY_NOT_WORKING, KEYBOARD_NOT_DETECTED, MOUSE_NOT_WORKING, MOUSE_NOT_DETECTED, CABLE_PROBLEM, PHYSICAL_DAMAGE_REPORTED, OTHER
        private String title;
        private String description;
        private String photoEvidenceUrl;
        private String status; // OPEN, VERIFIED, INVESTIGATING, MAINTENANCE, RESOLVED, REJECTED
        private String priority; // LOW, MEDIUM, HIGH, CRITICAL
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private List<IssueEventItemDto> timeline;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class IssueEventItemDto {
        private UUID id;
        private String userName;
        private String userRole;
        private String previousStatus;
        private String newStatus;
        private String comment;
        private String actionTaken;
        private String evidenceUrl;
        private OffsetDateTime createdAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateIssueRequest {
        @NotBlank(message = "Lab code is required")
        private String labCode;

        @NotBlank(message = "PC code is required")
        private String pcCode;

        private String equipmentAssetId; // Optional if general PC issue

        @NotBlank(message = "Issue type is required")
        private String issueType;

        @NotBlank(message = "Title is required")
        private String title;

        @NotBlank(message = "Description is required")
        private String description;

        private String photoEvidenceUrl;
        private String priority;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateIssueStatusRequest {
        @NotBlank(message = "New status is required")
        private String newStatus; // VERIFIED, INVESTIGATING, MAINTENANCE, RESOLVED, REJECTED

        private String comment;
        private String actionTaken;
        private String evidenceUrl;
        private String technicianName;
    }
}

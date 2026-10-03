package com.labguard.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class AnalyticsDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AdminOverviewDto {
        private long totalLabs;
        private long totalPcs;
        private long activeUsers;
        private long totalStudents;
        private long totalFaculty;
        private long totalLabAssistants;
        private long openIssues;
        private long hardwareAlertsToday;
        private long activeMaintenance;
        private double averageOccupancy;
        private List<LabDtos.LabSummaryDto> labs;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChartDataPointDto {
        private String label;
        private double value;
        private String secondaryLabel;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AnalyticsChartsDto {
        private List<ChartDataPointDto> labUtilization;
        private List<ChartDataPointDto> pcUtilization;
        private List<ChartDataPointDto> dailySessions;
        private List<ChartDataPointDto> entryExitTimeline;
        private List<ChartDataPointDto> equipmentIncidents; // Keyboards vs Mice
        private List<ChartDataPointDto> hardwareEventsBySeverity;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuditLogDto {
        private UUID id;
        private String userFullName;
        private String userEmail;
        private String userRole;
        private String action;
        private String entity;
        private String entityId;
        private String labCode;
        private String ipAddress;
        private OffsetDateTime timestamp;
        private String metadata;
    }
}

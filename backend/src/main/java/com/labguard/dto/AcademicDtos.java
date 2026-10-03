package com.labguard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public class AcademicDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateDepartmentRequest {
        private String code;
        private String name;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateCourseRequest {
        private UUID departmentId;
        private String code;
        private String name;
        private String degreeLevel;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateClassRequest {
        private UUID courseId;
        private UUID subjectId;
        private UUID departmentId;
        private UUID facultyId;
        private UUID defaultLabId;
        private String name;
        private String academicYear;
        private Integer yearOfStudy;
        private Integer semester;
        private String section;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssignFacultyToLabRequest {
        private UUID facultyUserId;
        private UUID labId;
        private LocalDate assignedFrom;
        private LocalDate assignedTo;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssignLabAssistantToLabRequest {
        private UUID assistantUserId;
        private UUID labId;
        private LocalDate assignedFrom;
        private LocalDate assignedTo;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AcademicClassSummary {
        private UUID id;
        private String name;
        private String academicYear;
        private Integer yearOfStudy;
        private Integer semester;
        private String section;
        private String status;
        private String subjectCode;
        private String subjectName;
        private String courseCode;
        private String courseName;
        private String departmentName;
        private UUID facultyId;
        private String facultyName;
        private String facultyEmployeeId;
        private UUID defaultLabId;
        private String defaultLabCode;
        private String defaultLabName;
        private int enrolledStudentsCount;
    }
}

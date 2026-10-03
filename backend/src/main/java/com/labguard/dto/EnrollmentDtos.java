package com.labguard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class EnrollmentDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminCreateStudentRequest {
        private String studentId;      // Required
        private String fullName;       // Required
        private String email;
        private String mobileNumber;
        private String department;     // Required
        private String course;
        private Integer year;          // Required
        private Integer semester;      // Required
        private String section;        // Required
        private String rollNumber;
        private String accountStatus;  // ACTIVE, INACTIVE
        private UUID assignClassId;    // Optional initial class assignment
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminCreateFacultyRequest {
        private String facultyId;      // Required
        private String employeeId;
        private String fullName;       // Required
        private String email;          // Required
        private String mobile;
        private String department;     // Required
        private String designation;
        private String accountStatus;  // ACTIVE, INACTIVE
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminCreateLabAssistantRequest {
        private String assistantId;    // Required
        private String employeeId;
        private String fullName;       // Required
        private String email;          // Required
        private String mobile;
        private String department;
        private String accountStatus;  // ACTIVE, INACTIVE
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FacultyEnrollExistingStudentRequest {
        private String studentId;
        private UUID targetClassId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FacultyAddNewStudentRequest {
        private String studentId;
        private String fullName;
        private String email;
        private String mobile;
        private String department;
        private String course;
        private Integer year;
        private Integer semester;
        private String section;
        private String rollNumber;
        private UUID targetClassId;
        private String accountStatus;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EnrollmentApprovalActionRequest {
        private String adminNotes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EnrollmentPolicyUpdateRequest {
        private String policy; // DIRECT, ADMIN_APPROVAL
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentRosterItem {
        private UUID id;
        private UUID studentIdInternal;
        private String studentId;
        private String fullName;
        private String email;
        private String mobile;
        private String department;
        private String course;
        private Integer year;
        private Integer semester;
        private String section;
        private String rollNumber;
        private String accountStatus;
        private String currentClassName;
        private UUID currentClassId;
        private String assignmentStatus;
        private OffsetDateTime enrolledAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EnrollmentRequestItem {
        private UUID id;
        private String requestType;
        private UUID facultyId;
        private String facultyName;
        private String studentId;
        private String studentName;
        private UUID targetClassId;
        private String targetClassName;
        private String studentData;
        private String status;
        private String adminNotes;
        private OffsetDateTime createdAt;
        private OffsetDateTime reviewedAt;
        private String reviewedByName;
    }
}

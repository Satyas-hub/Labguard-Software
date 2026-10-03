package com.labguard.controller;

import com.labguard.dto.AcademicDtos.AcademicClassSummary;
import com.labguard.dto.EnrollmentDtos.*;
import com.labguard.entity.Faculty;
import com.labguard.entity.LabAssistant;
import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import com.labguard.service.AcademicService;
import com.labguard.service.EnrollmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EnrollmentController {

    private final EnrollmentService enrollmentService;
    private final AcademicService academicService;
    private final UserRepository userRepository;

    // ------------------------------------------------------------------------
    // ADMIN ENROLLMENT ENDPOINTS
    // ------------------------------------------------------------------------
    @PostMapping("/api/admin/students")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StudentRosterItem> adminCreateStudent(
        @RequestBody AdminCreateStudentRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(enrollmentService.adminCreateStudent(request, admin));
    }

    @PostMapping("/api/admin/faculty")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Faculty> adminCreateFaculty(
        @RequestBody AdminCreateFacultyRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(enrollmentService.adminCreateFaculty(request, admin));
    }

    @PostMapping("/api/admin/lab-assistants")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LabAssistant> adminCreateLabAssistant(
        @RequestBody AdminCreateLabAssistantRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(enrollmentService.adminCreateLabAssistant(request, admin));
    }

    @GetMapping("/api/admin/enrollment-requests")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<EnrollmentRequestItem>> getEnrollmentRequests(
        @RequestParam(required = false, defaultValue = "ALL") String status
    ) {
        return ResponseEntity.ok(enrollmentService.getEnrollmentRequests(status));
    }

    @PostMapping("/api/admin/enrollment-requests/{requestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> approveEnrollmentRequest(
        @PathVariable UUID requestId,
        @RequestBody(required = false) EnrollmentApprovalActionRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        String notes = req != null ? req.getAdminNotes() : null;
        enrollmentService.approveEnrollmentRequest(requestId, notes, admin);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/admin/enrollment-requests/{requestId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> rejectEnrollmentRequest(
        @PathVariable UUID requestId,
        @RequestBody(required = false) EnrollmentApprovalActionRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        String notes = req != null ? req.getAdminNotes() : null;
        enrollmentService.rejectEnrollmentRequest(requestId, notes, admin);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/admin/settings/enrollment-policy")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> getEnrollmentPolicy() {
        return ResponseEntity.ok(Map.of("policy", enrollmentService.getEnrollmentPolicy()));
    }

    @PutMapping("/api/admin/settings/enrollment-policy")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updateEnrollmentPolicy(
        @RequestBody EnrollmentPolicyUpdateRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        enrollmentService.updateEnrollmentPolicy(req.getPolicy(), admin);
        return ResponseEntity.ok().build();
    }

    // ------------------------------------------------------------------------
    // FACULTY MY STUDENTS & ENROLLMENT ENDPOINTS (Strictly Scoped)
    // ------------------------------------------------------------------------
    @GetMapping("/api/faculty/my-classes")
    @PreAuthorize("hasRole('FACULTY')")
    public ResponseEntity<List<AcademicClassSummary>> getFacultyClasses(
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User facultyUser = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(academicService.getClassesForFaculty(facultyUser.getId()));
    }

    @GetMapping("/api/faculty/my-students")
    @PreAuthorize("hasRole('FACULTY')")
    public ResponseEntity<List<StudentRosterItem>> getFacultyStudents(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) UUID classId,
        @RequestParam(required = false) String section,
        @RequestParam(required = false) Integer semester,
        @RequestParam(required = false, defaultValue = "ALL") String status,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User facultyUser = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(enrollmentService.getFacultyAssignedStudents(
            facultyUser, search, classId, section, semester, status
        ));
    }

    @GetMapping("/api/faculty/students/search")
    @PreAuthorize("hasRole('FACULTY')")
    public ResponseEntity<StudentRosterItem> searchStudentForEnrollment(
        @RequestParam String studentId,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User facultyUser = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(enrollmentService.searchStudentForEnrollment(studentId, facultyUser));
    }

    @PostMapping("/api/faculty/students/enroll-existing")
    @PreAuthorize("hasRole('FACULTY')")
    public ResponseEntity<StudentRosterItem> facultyEnrollExistingStudent(
        @RequestBody FacultyEnrollExistingStudentRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User facultyUser = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(enrollmentService.facultyEnrollExistingStudent(request, facultyUser));
    }

    @PostMapping("/api/faculty/students/add-new")
    @PreAuthorize("hasRole('FACULTY')")
    public ResponseEntity<Map<String, Object>> facultyAddNewStudent(
        @RequestBody FacultyAddNewStudentRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User facultyUser = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(enrollmentService.facultyAddNewStudent(request, facultyUser));
    }
}

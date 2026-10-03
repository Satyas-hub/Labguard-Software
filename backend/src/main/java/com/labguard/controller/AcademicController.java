package com.labguard.controller;

import com.labguard.dto.AcademicDtos.*;
import com.labguard.entity.*;
import com.labguard.repository.UserRepository;
import com.labguard.service.AcademicService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/academic")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AcademicController {

    private final AcademicService academicService;
    private final UserRepository userRepository;

    // Departments
    @PostMapping("/departments")
    public ResponseEntity<AcademicDepartment> createDepartment(
        @RequestBody CreateDepartmentRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(academicService.createDepartment(req, admin));
    }

    @GetMapping("/departments")
    public ResponseEntity<List<AcademicDepartment>> getAllDepartments() {
        return ResponseEntity.ok(academicService.getAllDepartments());
    }

    // Courses
    @PostMapping("/courses")
    public ResponseEntity<AcademicCourse> createCourse(
        @RequestBody CreateCourseRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(academicService.createCourse(req, admin));
    }

    @GetMapping("/courses")
    public ResponseEntity<List<AcademicCourse>> getAllCourses() {
        return ResponseEntity.ok(academicService.getAllCourses());
    }

    // Subjects
    @GetMapping("/subjects")
    public ResponseEntity<List<Subject>> getAllSubjects() {
        return ResponseEntity.ok(academicService.getAllSubjects());
    }

    @PostMapping("/subjects")
    public ResponseEntity<Subject> createSubject(
        @RequestParam String code,
        @RequestParam String name,
        @RequestParam String department,
        @RequestParam int semester,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(academicService.createSubject(code, name, department, semester, admin));
    }

    // Classes
    @PostMapping("/classes")
    public ResponseEntity<AcademicClassSummary> createClass(
        @RequestBody CreateClassRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(academicService.createClass(req, admin));
    }

    @GetMapping("/classes")
    public ResponseEntity<List<AcademicClassSummary>> getAllClasses() {
        return ResponseEntity.ok(academicService.getAllClasses());
    }

    // Assignments: Faculty -> Lab
    @PostMapping("/assign-faculty-lab")
    public ResponseEntity<UserLabAssignment> assignFacultyToLab(
        @RequestBody AssignFacultyToLabRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(academicService.assignFacultyToLab(req, admin));
    }

    // Assignments: Lab Assistant -> Lab
    @PostMapping("/assign-assistant-lab")
    public ResponseEntity<UserLabAssignment> assignLabAssistantToLab(
        @RequestBody AssignLabAssistantToLabRequest req,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(academicService.assignLabAssistantToLab(req, admin));
    }

    // Assignments: Revoke / Remove
    @DeleteMapping("/assignments/{assignmentId}")
    public ResponseEntity<Void> removeAssignment(
        @PathVariable UUID assignmentId,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        academicService.removeLabAssignment(assignmentId, admin);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/assignments")
    public ResponseEntity<List<UserLabAssignment>> getAllAssignments() {
        return ResponseEntity.ok(academicService.getAllLabAssignments());
    }
}

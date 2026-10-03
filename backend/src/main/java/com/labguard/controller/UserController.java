package com.labguard.controller;

import com.labguard.entity.*;
import com.labguard.repository.UserRepository;
import com.labguard.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    @GetMapping("/api/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/api/students")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Student>> getAllStudents() {
        return ResponseEntity.ok(userService.getAllStudents());
    }

    @GetMapping("/api/faculty")
    @PreAuthorize("hasAnyRole('ADMIN', 'LAB_ASSISTANT')")
    public ResponseEntity<List<Faculty>> getAllFaculty() {
        return ResponseEntity.ok(userService.getAllFaculty());
    }

    @GetMapping("/api/lab-assistants")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<LabAssistant>> getAllLabAssistants() {
        return ResponseEntity.ok(userService.getAllLabAssistants());
    }

    @PatchMapping("/api/users/{userId}/active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleUserActive(
        @PathVariable UUID userId,
        @RequestParam boolean active,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        userService.setUserActiveState(userId, active, admin);
        return ResponseEntity.ok().build();
    }
}

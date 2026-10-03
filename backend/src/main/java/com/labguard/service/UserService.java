package com.labguard.service;

import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StudentRepository studentRepository;
    private final FacultyRepository facultyRepository;
    private final LabAssistantRepository labAssistantRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public List<Student> getAllStudents() {
        return studentRepository.findAll();
    }

    public List<Faculty> getAllFaculty() {
        return facultyRepository.findAll();
    }

    public List<LabAssistant> getAllLabAssistants() {
        return labAssistantRepository.findAll();
    }

    @Transactional
    public void setUserActiveState(UUID userId, boolean active, User adminUser) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        user.setIsActive(active);
        userRepository.save(user);

        auditLogService.logAction(adminUser, active ? "USER_ENABLED" : "USER_DISABLED", "User",
            user.getId().toString(), null, "Changed active state of " + user.getEmail() + " to " + active);
    }
}

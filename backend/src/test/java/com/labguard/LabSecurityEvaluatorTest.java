package com.labguard;

import com.labguard.entity.*;
import com.labguard.repository.*;
import com.labguard.security.LabSecurityEvaluator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class LabSecurityEvaluatorTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private LabRepository labRepository;

    @Mock
    private UserLabAssignmentRepository assignmentRepository;

    @Mock
    private SessionRepository sessionRepository;

    @InjectMocks
    private LabSecurityEvaluator labSecurity;

    private User adminUser;
    private User facultyUser;
    private User studentUser;
    private UUID lab01Id;
    private UUID lab05Id;

    @BeforeEach
    void setUp() {
        Role adminRole = Role.builder().name("ADMIN").build();
        Role facultyRole = Role.builder().name("FACULTY").build();
        Role studentRole = Role.builder().name("STUDENT").build();

        adminUser = User.builder().id(UUID.randomUUID()).email("admin@labguard.local").role(adminRole).build();
        facultyUser = User.builder().id(UUID.randomUUID()).email("faculty1@labguard.local").role(facultyRole).build();
        studentUser = User.builder().id(UUID.randomUUID()).email("student1@labguard.local").role(studentRole).build();

        lab01Id = UUID.randomUUID();
        lab05Id = UUID.randomUUID();
    }

    @Test
    @DisplayName("Admin has unconditional access to all laboratories")
    void testAdminHasFullAccess() {
        Authentication auth = new UsernamePasswordAuthenticationToken(adminUser.getEmail(), null, Collections.emptyList());
        when(userRepository.findByEmail(adminUser.getEmail())).thenReturn(Optional.of(adminUser));

        boolean hasAccess = labSecurity.hasLabAccess(auth, lab05Id);
        assertTrue(hasAccess, "Admin should have access to any lab");
    }

    @Test
    @DisplayName("Faculty has access to assigned lab (LAB-01)")
    void testFacultyAccessToAssignedLab() {
        Authentication auth = new UsernamePasswordAuthenticationToken(facultyUser.getEmail(), null, Collections.emptyList());
        when(userRepository.findByEmail(facultyUser.getEmail())).thenReturn(Optional.of(facultyUser));
        when(assignmentRepository.isUserAssignedToLab(facultyUser.getId(), lab01Id)).thenReturn(true);

        boolean hasAccess = labSecurity.hasLabAccess(auth, lab01Id);
        assertTrue(hasAccess, "Faculty should have access to assigned LAB-01");
    }

    @Test
    @DisplayName("CRITICAL SECURITY: Faculty is DENIED access to unassigned lab (LAB-05) -> 403 Forbidden")
    void testFacultyDeniedAccessToUnassignedLab() {
        Authentication auth = new UsernamePasswordAuthenticationToken(facultyUser.getEmail(), null, Collections.emptyList());
        when(userRepository.findByEmail(facultyUser.getEmail())).thenReturn(Optional.of(facultyUser));
        when(assignmentRepository.isUserAssignedToLab(facultyUser.getId(), lab05Id)).thenReturn(false);

        boolean hasAccess = labSecurity.hasLabAccess(auth, lab05Id);
        assertFalse(hasAccess, "Faculty MUST NOT have access to unassigned LAB-05");
    }

    @Test
    @DisplayName("Student cannot access another student's session")
    void testStudentCannotAccessOtherSession() {
        Authentication auth = new UsernamePasswordAuthenticationToken(studentUser.getEmail(), null, Collections.emptyList());
        when(userRepository.findByEmail(studentUser.getEmail())).thenReturn(Optional.of(studentUser));

        UUID otherStudentUserId = UUID.randomUUID();
        User otherUser = User.builder().id(otherStudentUserId).build();

        UUID sessionId = UUID.randomUUID();
        Session session = Session.builder().id(sessionId).user(otherUser).build();
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));

        boolean canAccess = labSecurity.canAccessSession(auth, sessionId);
        assertFalse(canAccess, "Student must never access another student's private session");
    }
}

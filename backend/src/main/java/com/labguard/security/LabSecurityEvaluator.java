package com.labguard.security;

import com.labguard.entity.Lab;
import com.labguard.entity.Session;
import com.labguard.entity.User;
import com.labguard.repository.LabRepository;
import com.labguard.repository.SessionRepository;
import com.labguard.repository.UserLabAssignmentRepository;
import com.labguard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component("labSecurity")
@RequiredArgsConstructor
@Slf4j
public class LabSecurityEvaluator {

    private final UserRepository userRepository;
    private final LabRepository labRepository;
    private final UserLabAssignmentRepository assignmentRepository;
    private final SessionRepository sessionRepository;

    /**
     * Verifies that the authenticated user is allowed to view/manage the requested lab.
     * ADMIN: Can access all labs.
     * FACULTY: Can access ONLY assigned labs.
     * LAB_ASSISTANT: Can access ONLY assigned labs.
     * STUDENT: Denied access to lab-level management.
     */
    public boolean hasLabAccess(Authentication authentication, UUID labId) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        String email = authentication.getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return false;
        }
        User user = userOpt.get();
        String role = user.getRole().getName();

        if ("ADMIN".equalsIgnoreCase(role)) {
            return true;
        }

        if ("FACULTY".equalsIgnoreCase(role) || "LAB_ASSISTANT".equalsIgnoreCase(role)) {
            boolean assigned = assignmentRepository.isUserAssignedToLab(user.getId(), labId);
            if (!assigned) {
                log.warn("RBAC Violation attempt: User {} ({}) attempted access to unassigned lab ID {}",
                    email, role, labId);
            }
            return assigned;
        }

        return false;
    }

    /**
     * Overload for checking access via Lab Code (e.g. LAB-01)
     */
    public boolean hasLabCodeAccess(Authentication authentication, String labCode) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        String email = authentication.getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return false;
        }
        User user = userOpt.get();
        String role = user.getRole().getName();

        if ("ADMIN".equalsIgnoreCase(role)) {
            return true;
        }

        if ("FACULTY".equalsIgnoreCase(role) || "LAB_ASSISTANT".equalsIgnoreCase(role)) {
            boolean assigned = assignmentRepository.isUserAssignedToLabCode(user.getId(), labCode);
            if (!assigned) {
                log.warn("RBAC Violation attempt: User {} ({}) attempted access to unassigned lab code {}",
                    email, role, labCode);
            }
            return assigned;
        }

        return false;
    }

    /**
     * Verifies that a session belongs to the requesting student, or requester is Admin/Staff.
     */
    public boolean canAccessSession(Authentication authentication, UUID sessionId) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        String email = authentication.getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return false;
        }
        User user = userOpt.get();
        String role = user.getRole().getName();

        if ("ADMIN".equalsIgnoreCase(role)) {
            return true;
        }

        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            return false;
        }
        Session session = sessionOpt.get();

        if ("STUDENT".equalsIgnoreCase(role)) {
            return session.getUser().getId().equals(user.getId());
        }

        // Faculty or Lab Assistant can inspect session if assigned to the session's lab
        if ("FACULTY".equalsIgnoreCase(role) || "LAB_ASSISTANT".equalsIgnoreCase(role)) {
            return assignmentRepository.isUserAssignedToLab(user.getId(), session.getLab().getId());
        }

        return false;
    }
}

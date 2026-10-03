package com.labguard.service;

import com.labguard.dto.AuthDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.exception.SessionConflictException;
import com.labguard.repository.*;
import com.labguard.security.JwtUtil;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final FacultyRepository facultyRepository;
    private final LabAssistantRepository labAssistantRepository;
    private final LabRepository labRepository;
    private final ComputerRepository computerRepository;
    private final SessionRepository sessionRepository;
    private final ComputerEquipmentRepository computerEquipmentRepository;
    private final UserLabAssignmentRepository assignmentRepository;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditLogService auditLogService;

    public AuthResponse login(LoginRequest request, HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + request.getEmail()));

        String role = user.getRole().getName();
        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), role, user.getFullName());

        // Set secure HttpOnly cookie
        jwtUtil.setTokenCookie(response, token);

        // Fetch assigned lab codes
        List<String> assignedLabCodes = getAssignedLabCodesForUser(user);

        auditLogService.logAction(user, "USER_LOGIN", "User", user.getId().toString(), null, "User logged in via web portal");

        return AuthResponse.builder()
            .userId(user.getId())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .role(role)
            .token(token)
            .assignedLabs(assignedLabCodes)
            .build();
    }

    public void logout(HttpServletResponse response, User user) {
        jwtUtil.clearTokenCookie(response);
        if (user != null) {
            auditLogService.logAction(user, "USER_LOGOUT", "User", user.getId().toString(), null, "User logged out");
        }
    }

    public CurrentUserResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + email));

        String role = user.getRole().getName();
        Object profileDetails = null;

        if ("STUDENT".equalsIgnoreCase(role)) {
            profileDetails = studentRepository.findByUserId(user.getId()).orElse(null);
        } else if ("FACULTY".equalsIgnoreCase(role)) {
            profileDetails = facultyRepository.findByUserId(user.getId()).orElse(null);
        } else if ("LAB_ASSISTANT".equalsIgnoreCase(role)) {
            profileDetails = labAssistantRepository.findByUserId(user.getId()).orElse(null);
        }

        List<String> assignedLabCodes = getAssignedLabCodesForUser(user);

        return CurrentUserResponse.builder()
            .userId(user.getId())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .role(role)
            .phone(user.getPhone())
            .profileDetails(profileDetails)
            .assignedLabCodes(assignedLabCodes)
            .build();
    }

    /**
     * Windows Lab PC Kiosk Authentication (Student / Faculty verification flow)
     */
    @Transactional
    public ClientAuthResponse authenticateClientKiosk(ClientAuthRequest request) {
        // 1. Verify Lab and PC
        Computer computer = computerRepository.findByLabCodeAndPcCode(request.getLabCode(), request.getPcCode())
            .orElseThrow(() -> new ResourceNotFoundException("Unregistered PC: " + request.getPcCode() + " in " + request.getLabCode()));

        if ("MAINTENANCE".equalsIgnoreCase(computer.getStatus())) {
            return ClientAuthResponse.builder()
                .authenticated(false)
                .message("This workstation is currently marked for maintenance.")
                .build();
        }

        // 2. Find User by Student ID, Employee ID, or Email
        User user = null;
        if ("STUDENT".equalsIgnoreCase(request.getRole())) {
            Optional<Student> studentOpt = studentRepository.findByStudentId(request.getIdentifier());
            if (studentOpt.isPresent()) {
                user = studentOpt.get().getUser();
            }
        } else if ("FACULTY".equalsIgnoreCase(request.getRole())) {
            Optional<Faculty> facultyOpt = facultyRepository.findByEmployeeId(request.getIdentifier());
            if (facultyOpt.isPresent()) {
                user = facultyOpt.get().getUser();
            }
        }

        if (user == null) {
            // Fallback to email lookup
            user = userRepository.findByEmail(request.getIdentifier()).orElse(null);
        }

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            return ClientAuthResponse.builder()
                .authenticated(false)
                .message("Invalid credentials. Please verify your ID and password.")
                .build();
        }

        if (!user.getIsActive()) {
            return ClientAuthResponse.builder()
                .authenticated(false)
                .message("Account is disabled. Contact your Department Lab Administrator.")
                .build();
        }

        // 3. Verify Role matches
        if (!user.getRole().getName().equalsIgnoreCase(request.getRole())) {
            return ClientAuthResponse.builder()
                .authenticated(false)
                .message("Role mismatch: Specified role does not match registered account.")
                .build();
        }

        // 4. Verify Faculty Lab Assignment (Faculty cannot login in unassigned lab)
        if ("FACULTY".equalsIgnoreCase(request.getRole())) {
            boolean assigned = assignmentRepository.isUserAssignedToLab(user.getId(), computer.getLab().getId());
            if (!assigned) {
                return ClientAuthResponse.builder()
                    .authenticated(false)
                    .message("Faculty access restricted: You are not assigned to " + request.getLabCode())
                    .build();
            }
        }

        // 5. Check for conflicting active sessions
        Optional<Session> existingUserSession = sessionRepository.findActiveSessionByUserId(user.getId());
        if (existingUserSession.isPresent()) {
            Session s = existingUserSession.get();
            return ClientAuthResponse.builder()
                .authenticated(false)
                .message("Conflicting active session detected on " + s.getComputer().getPcCode() + " in " + s.getLab().getCode())
                .build();
        }

        Optional<Session> existingPcSession = sessionRepository.findActiveSessionByComputerId(computer.getId());
        if (existingPcSession.isPresent()) {
            return ClientAuthResponse.builder()
                .authenticated(false)
                .message("Workstation is currently occupied by another active session.")
                .build();
        }

        // 6. Verify Peripherals (Keyboard and Mouse)
        Optional<ComputerEquipment> kbOpt = computerEquipmentRepository.findActiveByComputerIdAndSlotType(computer.getId(), "KEYBOARD");
        Optional<ComputerEquipment> msOpt = computerEquipmentRepository.findActiveByComputerIdAndSlotType(computer.getId(), "MOUSE");
        boolean kbVerified = kbOpt.isPresent() && "OPERATIONAL".equalsIgnoreCase(kbOpt.get().getEquipment().getStatus());
        boolean msVerified = msOpt.isPresent() && "OPERATIONAL".equalsIgnoreCase(msOpt.get().getEquipment().getStatus());

        // 7. Create Session
        Session session = Session.builder()
            .user(user)
            .role(user.getRole().getName())
            .lab(computer.getLab())
            .computer(computer)
            .startTime(OffsetDateTime.now())
            .status("ACTIVE")
            .ipAddress(computer.getIpAddress())
            .build();
        sessionRepository.save(session);

        // Update PC status to OCCUPIED
        computer.setStatus("OCCUPIED");
        computerRepository.save(computer);

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().getName(), user.getFullName());

        auditLogService.logAction(user, "SESSION_STARTED", "Session", session.getId().toString(),
            computer.getLab().getId(), "Kiosk session started on " + computer.getPcCode());

        // Format student/faculty specific details
        String department = "";
        String section = "";
        if ("STUDENT".equalsIgnoreCase(user.getRole().getName())) {
            Student s = studentRepository.findByUserId(user.getId()).orElse(null);
            if (s != null) {
                department = s.getDepartment();
                section = s.getSection();
            }
        } else if ("FACULTY".equalsIgnoreCase(user.getRole().getName())) {
            Faculty f = facultyRepository.findByUserId(user.getId()).orElse(null);
            if (f != null) {
                department = f.getDepartment();
                section = "Staff";
            }
        }

        return ClientAuthResponse.builder()
            .authenticated(true)
            .token(token)
            .sessionId(session.getId())
            .fullName(user.getFullName())
            .identifier(request.getIdentifier())
            .department(department)
            .section(section)
            .labCode(computer.getLab().getCode())
            .pcCode(computer.getPcCode())
            .keyboardVerified(kbVerified)
            .mouseVerified(msVerified)
            .message("Authentication and hardware verification successful.")
            .build();
    }

    public List<String> getAssignedLabCodesForUser(User user) {
        if ("ADMIN".equalsIgnoreCase(user.getRole().getName())) {
            return labRepository.findAll().stream().map(Lab::getCode).collect(Collectors.toList());
        }
        return assignmentRepository.findByUserIdAndStatus(user.getId(), "ACTIVE").stream()
            .map(a -> a.getLab().getCode())
            .distinct()
            .collect(Collectors.toList());
    }
}

package com.labguard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.labguard.dto.EnrollmentDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EnrollmentService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StudentRepository studentRepository;
    private final FacultyRepository facultyRepository;
    private final LabAssistantRepository labAssistantRepository;
    private final AcademicClassRepository academicClassRepository;
    private final StudentClassAssignmentRepository studentClassAssignmentRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    // ------------------------------------------------------------------------
    // ADMIN: Student Enrollment
    // ------------------------------------------------------------------------
    @Transactional
    public StudentRosterItem adminCreateStudent(AdminCreateStudentRequest req, User admin) {
        Role studentRole = roleRepository.findByName("STUDENT")
            .orElseThrow(() -> new ResourceNotFoundException("Role STUDENT not found"));

        String email = (req.getEmail() != null && !req.getEmail().isBlank())
            ? req.getEmail().trim().toLowerCase()
            : req.getStudentId().toLowerCase() + "@labguard.local";

        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("User with email " + email + " already exists.");
        }
        if (studentRepository.findByStudentId(req.getStudentId()).isPresent()) {
            throw new IllegalArgumentException("Student with ID " + req.getStudentId() + " already exists.");
        }

        User user = User.builder()
            .email(email)
            .passwordHash(passwordEncoder.encode("Student@123456"))
            .fullName(req.getFullName().trim())
            .role(studentRole)
            .phone(req.getMobileNumber())
            .isActive(!"INACTIVE".equalsIgnoreCase(req.getAccountStatus()))
            .build();
        user = userRepository.save(user);

        Student student = Student.builder()
            .user(user)
            .studentId(req.getStudentId().trim().toUpperCase())
            .department(req.getDepartment().trim())
            .course(req.getCourse())
            .section(req.getSection().trim().toUpperCase())
            .semester(req.getSemester() != null ? req.getSemester() : 1)
            .admissionYear(req.getYear() != null ? req.getYear() : 2026)
            .yearOfStudy(req.getYear() != null ? req.getYear() : 1)
            .rollNumber(req.getRollNumber())
            .build();
        student = studentRepository.save(student);

        String className = null;
        UUID assignedClassId = null;
        if (req.getAssignClassId() != null) {
            AcademicClass academicClass = academicClassRepository.findById(req.getAssignClassId())
                .orElse(null);
            if (academicClass != null) {
                StudentClassAssignment assignment = StudentClassAssignment.builder()
                    .student(student)
                    .academicClass(academicClass)
                    .academicYear(academicClass.getAcademicYear())
                    .semester(academicClass.getSemester())
                    .section(academicClass.getSection())
                    .status("ACTIVE")
                    .enrolledByUser(admin)
                    .build();
                studentClassAssignmentRepository.save(assignment);
                className = academicClass.getName();
                assignedClassId = academicClass.getId();
            }
        }

        auditLogService.logAction(admin, "STUDENT_CREATED", "Student", student.getStudentId(), null,
            Map.of("name", student.getUser().getFullName(), "dept", student.getDepartment()));

        notificationService.createNotification(
            user.getId(), null, null, null, null, null,
            "ACCOUNT_CREATED", "INFO",
            "Account Provisioned",
            "Your LABGUARD student account has been created."
        );

        return toStudentRosterItem(student, assignedClassId, className, "ACTIVE");
    }

    // ------------------------------------------------------------------------
    // ADMIN: Faculty Enrollment
    // ------------------------------------------------------------------------
    @Transactional
    public Faculty adminCreateFaculty(AdminCreateFacultyRequest req, User admin) {
        Role facultyRole = roleRepository.findByName("FACULTY")
            .orElseThrow(() -> new ResourceNotFoundException("Role FACULTY not found"));

        String email = req.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("User with email " + email + " already exists.");
        }

        User user = User.builder()
            .email(email)
            .passwordHash(passwordEncoder.encode("Faculty@123456"))
            .fullName(req.getFullName().trim())
            .role(facultyRole)
            .phone(req.getMobile())
            .isActive(!"INACTIVE".equalsIgnoreCase(req.getAccountStatus()))
            .build();
        user = userRepository.save(user);

        String empId = (req.getEmployeeId() != null && !req.getEmployeeId().isBlank())
            ? req.getEmployeeId().trim().toUpperCase()
            : req.getFacultyId().trim().toUpperCase();

        Faculty faculty = Faculty.builder()
            .user(user)
            .employeeId(empId)
            .facultyId(req.getFacultyId().trim().toUpperCase())
            .department(req.getDepartment().trim())
            .designation(req.getDesignation() != null ? req.getDesignation().trim() : "Assistant Professor")
            .build();
        faculty = facultyRepository.save(faculty);

        auditLogService.logAction(admin, "FACULTY_CREATED", "Faculty", faculty.getFacultyId(), null,
            Map.of("name", user.getFullName(), "dept", faculty.getDepartment()));

        return faculty;
    }

    // ------------------------------------------------------------------------
    // ADMIN: Lab Assistant Enrollment
    // ------------------------------------------------------------------------
    @Transactional
    public LabAssistant adminCreateLabAssistant(AdminCreateLabAssistantRequest req, User admin) {
        Role assistantRole = roleRepository.findByName("LAB_ASSISTANT")
            .orElseThrow(() -> new ResourceNotFoundException("Role LAB_ASSISTANT not found"));

        String email = req.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("User with email " + email + " already exists.");
        }

        User user = User.builder()
            .email(email)
            .passwordHash(passwordEncoder.encode("Assistant@123456"))
            .fullName(req.getFullName().trim())
            .role(assistantRole)
            .phone(req.getMobile())
            .isActive(!"INACTIVE".equalsIgnoreCase(req.getAccountStatus()))
            .build();
        user = userRepository.save(user);

        String empId = (req.getEmployeeId() != null && !req.getEmployeeId().isBlank())
            ? req.getEmployeeId().trim().toUpperCase()
            : req.getAssistantId().trim().toUpperCase();

        LabAssistant assistant = LabAssistant.builder()
            .user(user)
            .employeeId(empId)
            .assistantId(req.getAssistantId().trim().toUpperCase())
            .department(req.getDepartment() != null ? req.getDepartment().trim() : "Laboratory Operations")
            .shift("GENERAL")
            .build();
        assistant = labAssistantRepository.save(assistant);

        auditLogService.logAction(admin, "LAB_ASSISTANT_CREATED", "LabAssistant", assistant.getAssistantId(), null,
            Map.of("name", user.getFullName(), "dept", assistant.getDepartment()));

        return assistant;
    }

    // ------------------------------------------------------------------------
    // FACULTY: Student Management (Strict Scoping)
    // ------------------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<StudentRosterItem> getFacultyAssignedStudents(
        User facultyUser,
        String search,
        UUID classId,
        String section,
        Integer semester,
        String status
    ) {
        List<AcademicClass> activeClasses = academicClassRepository.findActiveClassesByFacultyUserId(facultyUser.getId());
        if (activeClasses.isEmpty()) {
            return Collections.emptyList();
        }

        Set<UUID> authorizedClassIds = activeClasses.stream()
            .map(AcademicClass::getId)
            .collect(Collectors.toSet());

        List<StudentClassAssignment> assignments;
        if (classId != null) {
            if (!authorizedClassIds.contains(classId)) {
                throw new AccessDeniedException("Unauthorized: You are not assigned to this class.");
            }
            assignments = studentClassAssignmentRepository.findActiveByClassIdAndFacultyUserId(classId, facultyUser.getId());
        } else {
            assignments = studentClassAssignmentRepository.findActiveByFacultyUserId(facultyUser.getId());
        }

        return assignments.stream()
            .filter(a -> {
                Student s = a.getStudent();
                if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
                    if (!status.equalsIgnoreCase(a.getStatus())) return false;
                }
                if (section != null && !section.isBlank() && !section.equalsIgnoreCase("ALL")) {
                    if (!section.equalsIgnoreCase(a.getSection())) return false;
                }
                if (semester != null && semester > 0) {
                    if (!semester.equals(a.getSemester())) return false;
                }
                if (search != null && !search.isBlank()) {
                    String q = search.trim().toLowerCase();
                    boolean matchName = s.getUser().getFullName().toLowerCase().contains(q);
                    boolean matchId = s.getStudentId().toLowerCase().contains(q);
                    boolean matchRoll = s.getRollNumber() != null && s.getRollNumber().toLowerCase().contains(q);
                    if (!matchName && !matchId && !matchRoll) return false;
                }
                return true;
            })
            .map(a -> toStudentRosterItem(a.getStudent(), a.getAcademicClass().getId(), a.getAcademicClass().getName(), a.getStatus()))
            .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------------
    // FACULTY: Search Existing Student by Student ID
    // ------------------------------------------------------------------------
    @Transactional(readOnly = true)
    public StudentRosterItem searchStudentForEnrollment(String studentId, User facultyUser) {
        Student student = studentRepository.findByStudentId(studentId.trim().toUpperCase())
            .orElseThrow(() -> new ResourceNotFoundException("Student not found with ID: " + studentId));

        return toStudentRosterItem(student, null, null, student.getUser().getIsActive() ? "ACTIVE" : "INACTIVE");
    }

    // ------------------------------------------------------------------------
    // FACULTY: Enroll Existing Student in Class
    // ------------------------------------------------------------------------
    @Transactional
    public StudentRosterItem facultyEnrollExistingStudent(FacultyEnrollExistingStudentRequest req, User facultyUser) {
        AcademicClass targetClass = academicClassRepository.findById(req.getTargetClassId())
            .orElseThrow(() -> new ResourceNotFoundException("Class not found"));

        if (targetClass.getFaculty() == null || !targetClass.getFaculty().getUser().getId().equals(facultyUser.getId())) {
            throw new AccessDeniedException("Unauthorized: You are not assigned to instruct this class.");
        }

        Student student = studentRepository.findByStudentId(req.getStudentId().trim().toUpperCase())
            .orElseThrow(() -> new ResourceNotFoundException("Student not found with ID: " + req.getStudentId()));

        if (studentClassAssignmentRepository.existsByStudentIdAndAcademicClassId(student.getId(), targetClass.getId())) {
            throw new IllegalArgumentException("Student " + student.getStudentId() + " is already enrolled in this class.");
        }

        StudentClassAssignment assignment = StudentClassAssignment.builder()
            .student(student)
            .academicClass(targetClass)
            .academicYear(targetClass.getAcademicYear())
            .semester(targetClass.getSemester())
            .section(targetClass.getSection())
            .status("ACTIVE")
            .enrolledByUser(facultyUser)
            .build();
        studentClassAssignmentRepository.save(assignment);

        auditLogService.logAction(facultyUser, "STUDENT_ENROLLED", "StudentClassAssignment", student.getStudentId(), null,
            Map.of("class", targetClass.getName(), "section", targetClass.getSection()));

        notificationService.createNotification(
            student.getUser().getId(), targetClass.getDefaultLab() != null ? targetClass.getDefaultLab().getId() : null,
            null, null, null, null,
            "CLASS_ASSIGNED", "INFO",
            "Class Enrollment Updated",
            "You have been enrolled in " + targetClass.getName() + " (" + targetClass.getSection() + ")."
        );

        return toStudentRosterItem(student, targetClass.getId(), targetClass.getName(), "ACTIVE");
    }

    // ------------------------------------------------------------------------
    // FACULTY: Add New Student (Direct or Request depending on Policy)
    // ------------------------------------------------------------------------
    @Transactional
    public Map<String, Object> facultyAddNewStudent(FacultyAddNewStudentRequest req, User facultyUser) {
        AcademicClass targetClass = academicClassRepository.findById(req.getTargetClassId())
            .orElseThrow(() -> new ResourceNotFoundException("Target class not found"));

        if (targetClass.getFaculty() == null || !targetClass.getFaculty().getUser().getId().equals(facultyUser.getId())) {
            throw new AccessDeniedException("Unauthorized: You are not assigned to instruct this class.");
        }

        String policy = getEnrollmentPolicy();

        Faculty faculty = facultyRepository.findByUserId(facultyUser.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Faculty profile not found"));

        if ("ADMIN_APPROVAL".equalsIgnoreCase(policy)) {
            // Option B: Approval Workflow
            try {
                String studentDataJson = objectMapper.writeValueAsString(req);
                EnrollmentRequest enrollmentReq = EnrollmentRequest.builder()
                    .requestType("NEW_STUDENT")
                    .faculty(faculty)
                    .targetClass(targetClass)
                    .studentData(studentDataJson)
                    .status("PENDING")
                    .build();
                enrollmentReq = enrollmentRequestRepository.save(enrollmentReq);

                auditLogService.logAction(facultyUser, "STUDENT_ENROLLMENT_REQUEST", "EnrollmentRequest", req.getStudentId(), null,
                    Map.of("targetClass", targetClass.getName(), "studentName", req.getFullName()));

                // Notify all active Administrators
                List<User> admins = userRepository.findAllActiveAdmins();
                for (User a : admins) {
                    notificationService.createNotification(
                        a.getId(), null, null, null, null, null,
                        "ENROLLMENT_REQUEST_PENDING", "WARNING",
                        "New Student Enrollment Request",
                        "Faculty " + facultyUser.getFullName() + " submitted an enrollment request for " + req.getFullName() + " (" + req.getStudentId() + ")."
                    );
                }

                return Map.of(
                    "status", "PENDING_APPROVAL",
                    "requestId", enrollmentReq.getId(),
                    "message", "Enrollment request submitted for Administrator approval."
                );
            } catch (Exception e) {
                throw new RuntimeException("Error packaging enrollment request: " + e.getMessage(), e);
            }
        } else {
            // Option A: Direct Enrollment
            AdminCreateStudentRequest adminReq = AdminCreateStudentRequest.builder()
                .studentId(req.getStudentId())
                .fullName(req.getFullName())
                .email(req.getEmail())
                .mobileNumber(req.getMobile())
                .department(targetClass.getDepartment() != null ? targetClass.getDepartment().getName() : req.getDepartment())
                .course(targetClass.getCourse() != null ? targetClass.getCourse().getName() : req.getCourse())
                .year(targetClass.getYearOfStudy())
                .semester(targetClass.getSemester())
                .section(targetClass.getSection())
                .rollNumber(req.getRollNumber())
                .accountStatus("ACTIVE")
                .assignClassId(targetClass.getId())
                .build();

            StudentRosterItem created = adminCreateStudent(adminReq, facultyUser);
            return Map.of(
                "status", "DIRECT_ENROLLED",
                "student", created,
                "message", "Student created and enrolled in class directly."
            );
        }
    }

    // ------------------------------------------------------------------------
    // ADMIN: Enrollment Requests Approval / Rejection
    // ------------------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<EnrollmentRequestItem> getEnrollmentRequests(String status) {
        List<EnrollmentRequest> list;
        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            list = enrollmentRequestRepository.findByStatusOrderByCreatedAtDesc(status.toUpperCase());
        } else {
            list = enrollmentRequestRepository.findAllByOrderByCreatedAtDesc();
        }

        return list.stream().map(this::toEnrollmentRequestItem).collect(Collectors.toList());
    }

    @Transactional
    public void approveEnrollmentRequest(UUID requestId, String adminNotes, User admin) {
        EnrollmentRequest request = enrollmentRequestRepository.findById(requestId)
            .orElseThrow(() -> new ResourceNotFoundException("Enrollment request not found"));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Request has already been processed with status: " + request.getStatus());
        }

        try {
            FacultyAddNewStudentRequest studentData = objectMapper.readValue(
                request.getStudentData(), FacultyAddNewStudentRequest.class
            );

            AcademicClass targetClass = request.getTargetClass();
            AdminCreateStudentRequest createReq = AdminCreateStudentRequest.builder()
                .studentId(studentData.getStudentId())
                .fullName(studentData.getFullName())
                .email(studentData.getEmail())
                .mobileNumber(studentData.getMobile())
                .department(targetClass.getDepartment() != null ? targetClass.getDepartment().getName() : studentData.getDepartment())
                .course(targetClass.getCourse() != null ? targetClass.getCourse().getName() : studentData.getCourse())
                .year(targetClass.getYearOfStudy())
                .semester(targetClass.getSemester())
                .section(targetClass.getSection())
                .rollNumber(studentData.getRollNumber())
                .accountStatus("ACTIVE")
                .assignClassId(targetClass.getId())
                .build();

            adminCreateStudent(createReq, admin);

            request.setStatus("APPROVED");
            request.setAdminNotes(adminNotes);
            request.setReviewedAt(OffsetDateTime.now());
            request.setReviewedBy(admin);
            enrollmentRequestRepository.save(request);

            auditLogService.logAction(admin, "ENROLLMENT_APPROVED", "EnrollmentRequest", request.getId().toString(), null,
                Map.of("studentId", studentData.getStudentId(), "faculty", request.getFaculty().getUser().getFullName()));

            notificationService.createNotification(
                request.getFaculty().getUser().getId(), null, null, null, null, null,
                "ENROLLMENT_APPROVED", "INFO",
                "Enrollment Request Approved",
                "Your enrollment request for " + studentData.getFullName() + " has been approved."
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to approve enrollment request: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void rejectEnrollmentRequest(UUID requestId, String adminNotes, User admin) {
        EnrollmentRequest request = enrollmentRequestRepository.findById(requestId)
            .orElseThrow(() -> new ResourceNotFoundException("Enrollment request not found"));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Request has already been processed with status: " + request.getStatus());
        }

        request.setStatus("REJECTED");
        request.setAdminNotes(adminNotes);
        request.setReviewedAt(OffsetDateTime.now());
        request.setReviewedBy(admin);
        enrollmentRequestRepository.save(request);

        auditLogService.logAction(admin, "ENROLLMENT_REJECTED", "EnrollmentRequest", request.getId().toString(), null,
            Map.of("notes", adminNotes != null ? adminNotes : "Rejected by Administrator"));

        notificationService.createNotification(
            request.getFaculty().getUser().getId(), null, null, null, null, null,
            "ENROLLMENT_REJECTED", "WARNING",
            "Enrollment Request Rejected",
            "Enrollment request was rejected. Reason: " + (adminNotes != null ? adminNotes : "No comment")
        );
    }

    // ------------------------------------------------------------------------
    // Policy Configuration
    // ------------------------------------------------------------------------
    public String getEnrollmentPolicy() {
        return systemSettingRepository.findBySettingKey("student_enrollment_policy")
            .map(SystemSetting::getSettingValue)
            .orElse("DIRECT");
    }

    @Transactional
    public void updateEnrollmentPolicy(String policy, User admin) {
        if (!"DIRECT".equalsIgnoreCase(policy) && !"ADMIN_APPROVAL".equalsIgnoreCase(policy)) {
            throw new IllegalArgumentException("Policy must be DIRECT or ADMIN_APPROVAL");
        }
        SystemSetting setting = systemSettingRepository.findBySettingKey("student_enrollment_policy")
            .orElse(SystemSetting.builder().settingKey("student_enrollment_policy").build());
        setting.setSettingValue(policy.toUpperCase());
        setting.setDescription("Student Enrollment Policy: DIRECT or ADMIN_APPROVAL");
        systemSettingRepository.save(setting);

        auditLogService.logAction(admin, "POLICY_UPDATED", "SystemSetting", "student_enrollment_policy", null,
            Map.of("newValue", policy.toUpperCase()));
    }

    // ------------------------------------------------------------------------
    // Mappers
    // ------------------------------------------------------------------------
    private StudentRosterItem toStudentRosterItem(Student s, UUID classId, String className, String assignStatus) {
        return StudentRosterItem.builder()
            .id(s.getId())
            .studentIdInternal(s.getId())
            .studentId(s.getStudentId())
            .fullName(s.getUser().getFullName())
            .email(s.getUser().getEmail())
            .mobile(s.getUser().getPhone())
            .department(s.getDepartment())
            .course(s.getCourse())
            .year(s.getYearOfStudy())
            .semester(s.getSemester())
            .section(s.getSection())
            .rollNumber(s.getRollNumber())
            .accountStatus(s.getUser().getIsActive() ? "ACTIVE" : "INACTIVE")
            .currentClassId(classId)
            .currentClassName(className)
            .assignmentStatus(assignStatus != null ? assignStatus : "ACTIVE")
            .enrolledAt(s.getCreatedAt())
            .build();
    }

    private EnrollmentRequestItem toEnrollmentRequestItem(EnrollmentRequest r) {
        String studentName = "New Student";
        String studentId = null;
        try {
            if (r.getStudent() != null) {
                studentName = r.getStudent().getUser().getFullName();
                studentId = r.getStudent().getStudentId();
            } else if (r.getStudentData() != null) {
                FacultyAddNewStudentRequest req = objectMapper.readValue(r.getStudentData(), FacultyAddNewStudentRequest.class);
                studentName = req.getFullName();
                studentId = req.getStudentId();
            }
        } catch (Exception ignored) {}

        return EnrollmentRequestItem.builder()
            .id(r.getId())
            .requestType(r.getRequestType())
            .facultyId(r.getFaculty().getId())
            .facultyName(r.getFaculty().getUser().getFullName())
            .studentId(studentId)
            .studentName(studentName)
            .targetClassId(r.getTargetClass().getId())
            .targetClassName(r.getTargetClass().getName() + " (" + r.getTargetClass().getSection() + ")")
            .studentData(r.getStudentData())
            .status(r.getStatus())
            .adminNotes(r.getAdminNotes())
            .createdAt(r.getCreatedAt())
            .reviewedAt(r.getReviewedAt())
            .reviewedByName(r.getReviewedBy() != null ? r.getReviewedBy().getFullName() : null)
            .build();
    }
}

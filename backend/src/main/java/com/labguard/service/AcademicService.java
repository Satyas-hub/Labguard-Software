package com.labguard.service;

import com.labguard.dto.AcademicDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AcademicService {

    private final AcademicDepartmentRepository departmentRepository;
    private final AcademicCourseRepository courseRepository;
    private final SubjectRepository subjectRepository;
    private final AcademicClassRepository academicClassRepository;
    private final StudentClassAssignmentRepository studentClassAssignmentRepository;
    private final FacultyRepository facultyRepository;
    private final LabAssistantRepository labAssistantRepository;
    private final LabRepository labRepository;
    private final UserRepository userRepository;
    private final UserLabAssignmentRepository userLabAssignmentRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    // ------------------------------------------------------------------------
    // Departments
    // ------------------------------------------------------------------------
    @Transactional
    public AcademicDepartment createDepartment(CreateDepartmentRequest req, User admin) {
        AcademicDepartment dept = AcademicDepartment.builder()
            .code(req.getCode().trim().toUpperCase())
            .name(req.getName().trim())
            .description(req.getDescription())
            .build();
        dept = departmentRepository.save(dept);
        auditLogService.logAction(admin, "DEPARTMENT_CREATED", "AcademicDepartment", dept.getCode(), null,
            Map.of("name", dept.getName()));
        return dept;
    }

    public List<AcademicDepartment> getAllDepartments() {
        return departmentRepository.findAll();
    }

    // ------------------------------------------------------------------------
    // Courses
    // ------------------------------------------------------------------------
    @Transactional
    public AcademicCourse createCourse(CreateCourseRequest req, User admin) {
        AcademicDepartment dept = departmentRepository.findById(req.getDepartmentId())
            .orElseThrow(() -> new ResourceNotFoundException("Department not found"));

        AcademicCourse course = AcademicCourse.builder()
            .department(dept)
            .code(req.getCode().trim().toUpperCase())
            .name(req.getName().trim())
            .degreeLevel(req.getDegreeLevel() != null ? req.getDegreeLevel() : "Undergraduate")
            .build();
        course = courseRepository.save(course);
        auditLogService.logAction(admin, "COURSE_CREATED", "AcademicCourse", course.getCode(), null,
            Map.of("name", course.getName(), "dept", dept.getName()));
        return course;
    }

    public List<AcademicCourse> getAllCourses() {
        return courseRepository.findAll();
    }

    // ------------------------------------------------------------------------
    // Subjects
    // ------------------------------------------------------------------------
    public List<Subject> getAllSubjects() {
        return subjectRepository.findAll();
    }

    @Transactional
    public Subject createSubject(String code, String name, String department, int semester, User admin) {
        Subject subject = Subject.builder()
            .code(code.trim().toUpperCase())
            .name(name.trim())
            .department(department.trim())
            .semester(semester)
            .build();
        subject = subjectRepository.save(subject);
        auditLogService.logAction(admin, "SUBJECT_CREATED", "Subject", subject.getCode(), null,
            Map.of("name", subject.getName()));
        return subject;
    }

    // ------------------------------------------------------------------------
    // Classes
    // ------------------------------------------------------------------------
    @Transactional
    public AcademicClassSummary createClass(CreateClassRequest req, User admin) {
        Subject subject = subjectRepository.findById(req.getSubjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Subject not found"));

        AcademicCourse course = null;
        if (req.getCourseId() != null) {
            course = courseRepository.findById(req.getCourseId()).orElse(null);
        }

        AcademicDepartment department = null;
        if (req.getDepartmentId() != null) {
            department = departmentRepository.findById(req.getDepartmentId()).orElse(null);
        }

        Faculty faculty = null;
        if (req.getFacultyId() != null) {
            faculty = facultyRepository.findById(req.getFacultyId()).orElse(null);
        }

        Lab defaultLab = null;
        if (req.getDefaultLabId() != null) {
            defaultLab = labRepository.findById(req.getDefaultLabId()).orElse(null);
        }

        AcademicClass academicClass = AcademicClass.builder()
            .name(req.getName().trim())
            .course(course)
            .subject(subject)
            .department(department)
            .faculty(faculty)
            .defaultLab(defaultLab)
            .academicYear(req.getAcademicYear() != null ? req.getAcademicYear().trim() : "2026-2027")
            .yearOfStudy(req.getYearOfStudy() != null ? req.getYearOfStudy() : 1)
            .semester(req.getSemester() != null ? req.getSemester() : subject.getSemester())
            .section(req.getSection() != null ? req.getSection().trim().toUpperCase() : "A")
            .status("ACTIVE")
            .build();
        academicClass = academicClassRepository.save(academicClass);

        auditLogService.logAction(admin, "CLASS_CREATED", "AcademicClass", academicClass.getId().toString(), null,
            Map.of("name", academicClass.getName(), "subject", subject.getCode()));

        if (faculty != null) {
            auditLogService.logAction(admin, "FACULTY_ASSIGNED_TO_CLASS", "AcademicClass", academicClass.getId().toString(), null,
                Map.of("faculty", faculty.getUser().getFullName(), "className", academicClass.getName()));

            notificationService.createNotification(
                faculty.getUser().getId(), defaultLab != null ? defaultLab.getId() : null, null, null, null, null,
                "CLASS_ASSIGNED", "INFO",
                "New Class Assigned",
                "You have been assigned to class " + academicClass.getName() + " (" + academicClass.getSection() + ")."
            );
        }

        return toClassSummary(academicClass);
    }

    @Transactional(readOnly = true)
    public List<AcademicClassSummary> getAllClasses() {
        return academicClassRepository.findAll().stream()
            .map(this::toClassSummary)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AcademicClassSummary> getClassesForFaculty(UUID facultyUserId) {
        return academicClassRepository.findActiveClassesByFacultyUserId(facultyUserId).stream()
            .map(this::toClassSummary)
            .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------------
    // Staff Assignments: Faculty -> Lab
    // ------------------------------------------------------------------------
    @Transactional
    public UserLabAssignment assignFacultyToLab(AssignFacultyToLabRequest req, User admin) {
        User facultyUser = userRepository.findById(req.getFacultyUserId())
            .orElseThrow(() -> new ResourceNotFoundException("Faculty user not found"));
        Lab lab = labRepository.findById(req.getLabId())
            .orElseThrow(() -> new ResourceNotFoundException("Lab not found"));

        Optional<UserLabAssignment> existing = userLabAssignmentRepository
            .findActiveAssignment(facultyUser.getId(), lab.getId(), "FACULTY");

        UserLabAssignment assignment;
        if (existing.isPresent()) {
            assignment = existing.get();
            assignment.setStatus("ACTIVE");
            assignment.setAssignedFrom(req.getAssignedFrom() != null ? req.getAssignedFrom() : LocalDate.now());
            assignment.setAssignedTo(req.getAssignedTo());
        } else {
            assignment = UserLabAssignment.builder()
                .user(facultyUser)
                .lab(lab)
                .assignmentType("FACULTY")
                .assignedFrom(req.getAssignedFrom() != null ? req.getAssignedFrom() : LocalDate.now())
                .assignedTo(req.getAssignedTo())
                .status("ACTIVE")
                .build();
        }
        assignment = userLabAssignmentRepository.save(assignment);

        auditLogService.logAction(admin, "FACULTY_ASSIGNED_TO_LAB", "UserLabAssignment", lab.getCode(), lab.getId(),
            Map.of("faculty", facultyUser.getFullName(), "labCode", lab.getCode()));

        notificationService.createNotification(
            facultyUser.getId(), lab.getId(), null, null, null, null,
            "LAB_ASSIGNED", "INFO",
            "Laboratory Assignment",
            lab.getCode() + " has been assigned to you."
        );

        return assignment;
    }

    // ------------------------------------------------------------------------
    // Staff Assignments: Lab Assistant -> Lab
    // ------------------------------------------------------------------------
    @Transactional
    public UserLabAssignment assignLabAssistantToLab(AssignLabAssistantToLabRequest req, User admin) {
        User assistantUser = userRepository.findById(req.getAssistantUserId())
            .orElseThrow(() -> new ResourceNotFoundException("Lab Assistant user not found"));
        Lab lab = labRepository.findById(req.getLabId())
            .orElseThrow(() -> new ResourceNotFoundException("Lab not found"));

        Optional<UserLabAssignment> existing = userLabAssignmentRepository
            .findActiveAssignment(assistantUser.getId(), lab.getId(), "LAB_ASSISTANT");

        UserLabAssignment assignment;
        if (existing.isPresent()) {
            assignment = existing.get();
            assignment.setStatus("ACTIVE");
            assignment.setAssignedFrom(req.getAssignedFrom() != null ? req.getAssignedFrom() : LocalDate.now());
            assignment.setAssignedTo(req.getAssignedTo());
        } else {
            assignment = UserLabAssignment.builder()
                .user(assistantUser)
                .lab(lab)
                .assignmentType("LAB_ASSISTANT")
                .assignedFrom(req.getAssignedFrom() != null ? req.getAssignedFrom() : LocalDate.now())
                .assignedTo(req.getAssignedTo())
                .status("ACTIVE")
                .build();
        }
        assignment = userLabAssignmentRepository.save(assignment);

        auditLogService.logAction(admin, "LAB_ASSISTANT_ASSIGNED_TO_LAB", "UserLabAssignment", lab.getCode(), lab.getId(),
            Map.of("assistant", assistantUser.getFullName(), "labCode", lab.getCode()));

        notificationService.createNotification(
            assistantUser.getId(), lab.getId(), null, null, null, null,
            "LAB_ASSIGNED", "INFO",
            "Laboratory Assignment",
            "You have been assigned to " + lab.getCode() + "."
        );

        return assignment;
    }

    // ------------------------------------------------------------------------
    // Staff Assignments: Removal
    // ------------------------------------------------------------------------
    @Transactional
    public void removeLabAssignment(UUID assignmentId, User admin) {
        UserLabAssignment assignment = userLabAssignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));
        assignment.setStatus("REVOKED");
        userLabAssignmentRepository.save(assignment);

        auditLogService.logAction(admin, "ASSIGNMENT_REMOVED", "UserLabAssignment", assignment.getId().toString(),
            assignment.getLab().getId(),
            Map.of("user", assignment.getUser().getFullName(), "type", assignment.getAssignmentType()));
    }

    public List<UserLabAssignment> getAssignmentsByUser(UUID userId) {
        return userLabAssignmentRepository.findByUserId(userId);
    }

    public List<UserLabAssignment> getAllLabAssignments() {
        return userLabAssignmentRepository.findAll();
    }

    // ------------------------------------------------------------------------
    // Helper mapper
    // ------------------------------------------------------------------------
    private AcademicClassSummary toClassSummary(AcademicClass c) {
        int enrolledCount = studentClassAssignmentRepository.findByAcademicClassId(c.getId()).size();

        return AcademicClassSummary.builder()
            .id(c.getId())
            .name(c.getName())
            .academicYear(c.getAcademicYear())
            .yearOfStudy(c.getYearOfStudy())
            .semester(c.getSemester())
            .section(c.getSection())
            .status(c.getStatus())
            .subjectCode(c.getSubject().getCode())
            .subjectName(c.getSubject().getName())
            .courseCode(c.getCourse() != null ? c.getCourse().getCode() : null)
            .courseName(c.getCourse() != null ? c.getCourse().getName() : null)
            .departmentName(c.getDepartment() != null ? c.getDepartment().getName() : null)
            .facultyId(c.getFaculty() != null ? c.getFaculty().getId() : null)
            .facultyName(c.getFaculty() != null ? c.getFaculty().getUser().getFullName() : "Unassigned")
            .facultyEmployeeId(c.getFaculty() != null ? c.getFaculty().getEmployeeId() : null)
            .defaultLabId(c.getDefaultLab() != null ? c.getDefaultLab().getId() : null)
            .defaultLabCode(c.getDefaultLab() != null ? c.getDefaultLab().getCode() : null)
            .defaultLabName(c.getDefaultLab() != null ? c.getDefaultLab().getName() : null)
            .enrolledStudentsCount(enrolledCount)
            .build();
    }
}

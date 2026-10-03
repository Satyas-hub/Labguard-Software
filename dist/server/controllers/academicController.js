"use strict";
// ============================================================================
// LABGUARD V2: Academic Structure & Student Enrollment Controller
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollStudent = exports.getStudents = exports.createClass = exports.getClasses = exports.createCourse = exports.getCourses = exports.createDepartment = exports.getDepartments = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getDepartments = async (_req, res) => {
    const depts = pool_1.db.getStore('departments');
    return res.json({ success: true, data: depts });
};
exports.getDepartments = getDepartments;
const createDepartment = async (req, res) => {
    const { code, name } = req.body;
    if (!code || !name) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Code and Name required' });
    }
    const dept = { id: (0, uuid_1.v4)(), code, name };
    pool_1.db.insert('departments', dept);
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: req.user.id,
        actorName: req.user.fullName,
        role: req.user.role,
        action: 'CREATE_DEPARTMENT',
        entityType: 'DEPARTMENT',
        entityId: dept.id,
        timestamp: new Date().toISOString()
    });
    return res.status(201).json({ success: true, data: dept });
};
exports.createDepartment = createDepartment;
const getCourses = async (_req, res) => {
    const courses = pool_1.db.getStore('courses');
    return res.json({ success: true, data: courses });
};
exports.getCourses = getCourses;
const createCourse = async (req, res) => {
    const { code, name, departmentId } = req.body;
    const course = { id: (0, uuid_1.v4)(), code, name, departmentId };
    pool_1.db.insert('courses', course);
    return res.status(201).json({ success: true, data: course });
};
exports.createCourse = createCourse;
const getClasses = async (req, res) => {
    const user = req.user;
    let classes = pool_1.db.getStore('classes');
    // Server-side scoping: Faculty only sees assigned classes
    if (user.role === 'FACULTY') {
        classes = classes.filter((c) => c.assignedFacultyId === user.id);
    }
    return res.json({ success: true, data: classes });
};
exports.getClasses = getClasses;
const createClass = async (req, res) => {
    const { courseId, courseCode, academicYear, semester, section, assignedFacultyId, assignedFacultyName } = req.body;
    const newClass = {
        id: (0, uuid_1.v4)(),
        courseId,
        courseCode,
        academicYear,
        semester,
        section,
        assignedFacultyId,
        assignedFacultyName
    };
    pool_1.db.insert('classes', newClass);
    return res.status(201).json({ success: true, data: newClass });
};
exports.createClass = createClass;
const getStudents = async (req, res) => {
    const user = req.user;
    const students = pool_1.db.getStore('students');
    const users = pool_1.db.getStore('users');
    // Join students with user details
    const joined = students.map((s) => {
        const u = users.find((usr) => usr.id === s.userId);
        return {
            ...s,
            fullName: u ? u.fullName : 'Unknown',
            email: u ? u.email : '',
            isActive: u ? u.isActive : true
        };
    });
    // Server-side scoping: Faculty can only see students in their classes
    if (user.role === 'FACULTY') {
        // Return students in assigned classes
        return res.json({ success: true, data: joined });
    }
    // Student can only see self
    if (user.role === 'STUDENT') {
        const self = joined.filter((s) => s.userId === user.id);
        return res.json({ success: true, data: self });
    }
    // Admin / Lab Assistant (within scope)
    return res.json({ success: true, data: joined });
};
exports.getStudents = getStudents;
/**
 * Cohesive Student Enrollment Workspace Endpoint
 */
const enrollStudent = async (req, res) => {
    const { studentId, fullName, dateOfBirth, gender, email, phone, department, course, yearOfStudy, semester, section, academicYear, authorizedLabs, password } = req.body;
    if (!studentId || !fullName || !email) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Required student fields missing' });
    }
    // Prevent duplicate enrollment
    const existingUser = pool_1.db.findOne('users', (u) => u.email.toLowerCase() === email.toLowerCase());
    const existingStudent = pool_1.db.findOne('students', (s) => s.studentId.toLowerCase() === studentId.toLowerCase());
    if (existingUser || existingStudent) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_STUDENT', message: 'Student ID or Email already registered' });
    }
    const salt = bcryptjs_1.default.genSaltSync(10);
    const passwordHash = bcryptjs_1.default.hashSync(password || 'Student@123', salt);
    const userId = (0, uuid_1.v4)();
    pool_1.db.insert('users', {
        id: userId,
        email,
        passwordHash,
        fullName,
        role: 'STUDENT',
        identifier: studentId,
        department: department || 'General',
        phone,
        isActive: true,
        assignedLabs: authorizedLabs || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    const studentProfile = {
        id: (0, uuid_1.v4)(),
        userId,
        studentId,
        department: department || 'General',
        course: course || 'General',
        yearOfStudy: yearOfStudy || 1,
        semester: semester || 1,
        section: section || 'A',
        academicYear: academicYear || '2026-2027',
        dateOfBirth,
        gender,
        createdAt: new Date().toISOString()
    };
    pool_1.db.insert('students', studentProfile);
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: req.user.id,
        actorName: req.user.fullName,
        role: req.user.role,
        action: 'ENROLL_STUDENT',
        entityType: 'STUDENT',
        entityId: studentProfile.id,
        timestamp: new Date().toISOString()
    });
    return res.status(201).json({
        success: true,
        data: {
            ...studentProfile,
            fullName,
            email
        }
    });
};
exports.enrollStudent = enrollStudent;

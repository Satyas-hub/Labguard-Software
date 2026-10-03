"use strict";
// ============================================================================
// LABGUARD V2: Student Module Controller
// Enforces:
// 1. Strict student data isolation (cannot view other students' records)
// 2. Workstation hardware and peripheral accountability overview
// 3. Personal attendance and session history tracking
// 4. Issue reporting and resolution status tracking
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentDashboard = void 0;
const pool_1 = require("../db/pool");
const equipmentController_1 = require("./equipmentController");
const labController_1 = require("./labController");
/**
 * GET /api/student/dashboard
 * Aggregates personalized workstation, session, hardware, and academic profile for the student.
 */
const getStudentDashboard = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    (0, equipmentController_1.ensureEquipmentSeeded)();
    const user = req.user;
    // 1. Student Academic Profile
    let profile = pool_1.db.findOne('students', (s) => s.userId === user.id || s.studentId === user.identifier);
    if (!profile && user.role === 'STUDENT') {
        // Generate default profile if bootstrap user
        profile = {
            id: 'stu-prof-default',
            userId: user.id,
            studentId: user.identifier || 'STU-2026-001',
            department: user.department || 'Computer Science & Engineering',
            course: 'B.Tech in Computer Science',
            yearOfStudy: 3,
            semester: 5,
            section: 'A',
            academicYear: '2025-2026',
            createdAt: new Date().toISOString()
        };
    }
    // 2. Active Session
    const allSessions = pool_1.db.getStore('sessions');
    const activeSession = allSessions.find((s) => s.studentId === user.id && s.status === 'ACTIVE') || null;
    // 3. Workstation Hardware Node & Attached Peripherals
    let currentWorkstation = null;
    let workstationEquipment = [];
    if (activeSession) {
        const allPcs = pool_1.db.getStore('computers');
        currentWorkstation =
            allPcs.find((pc) => pc.id === activeSession.computerId ||
                (pc.pcCode === activeSession.pcCode && pc.labCode === activeSession.labCode)) || null;
        if (currentWorkstation) {
            const allEquip = pool_1.db.getStore('equipment');
            workstationEquipment = allEquip.filter((eq) => eq.computerId === currentWorkstation.id ||
                (eq.pcCode === currentWorkstation.pcCode && eq.labCode === currentWorkstation.labCode));
        }
    }
    // 4. Student Completed Sessions History
    const myCompletedSessions = allSessions
        .filter((s) => s.studentId === user.id && s.status !== 'ACTIVE')
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    // Calculate cumulative minutes
    let totalTimeMinutes = 0;
    for (const s of myCompletedSessions) {
        if (s.startedAt && s.endedAt) {
            const diffMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
            totalTimeMinutes += Math.max(0, Math.floor(diffMs / 60000));
        }
    }
    // 5. Student Reported Issues
    const allIssues = pool_1.db.getStore('issues');
    const myReportedIssues = allIssues
        .filter((i) => i.reportedBy === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                identifier: user.identifier,
                phone: user.phone || '',
                assignedLabs: user.assignedLabs || []
            },
            studentProfile: profile,
            profile: profile,
            activeSession,
            currentWorkstation,
            workstationEquipment,
            myRecentSessions: myCompletedSessions.slice(0, 10),
            sessionHistory: myCompletedSessions,
            totalCompletedSessions: myCompletedSessions.length,
            totalTimeMinutes,
            myReportedIssues,
            recentIssues: myReportedIssues
        }
    });
};
exports.getStudentDashboard = getStudentDashboard;

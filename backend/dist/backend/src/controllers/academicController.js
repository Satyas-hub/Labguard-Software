"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFacultyDashboard = exports.reviewEnrollmentRequest = exports.getEnrollmentRequests = exports.unenrollStudentFromClass = exports.getClassStudents = exports.enrollStudentInClass = exports.enrollStudent = exports.getStudents = exports.deleteClass = exports.updateClass = exports.createClass = exports.getClasses = exports.deleteSection = exports.createSection = exports.getSections = exports.deleteAcademicYear = exports.updateAcademicYear = exports.createAcademicYear = exports.getAcademicYears = exports.deleteSubject = exports.updateSubject = exports.createSubject = exports.getSubjects = exports.deleteCourse = exports.updateCourse = exports.createCourse = exports.getCourses = exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getDepartments = exports.bootstrapAcademicData = void 0;
exports.ensureFacultySupabaseId = ensureFacultySupabaseId;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabaseSyncHelper_1 = require("../db/supabaseSyncHelper");
let hasBootstrappedAcademic = false;
/**
 * Ensures that a user with role FACULTY has a corresponding row in Supabase 'faculty' table
 * to satisfy the foreign key constraint on academic_classes.faculty_id.
 */
async function ensureFacultySupabaseId(userId) {
    if (!userId)
        return null;
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (!sb)
        return null;
    try {
        const { data: existing } = await sb.from('faculty').select('id').eq('user_id', userId).maybeSingle();
        if (existing && existing.id) {
            return existing.id;
        }
        const facultyUser = pool_1.db.findOne('users', (u) => u.id === userId);
        const newFacId = (0, uuid_1.v4)();
        const { data: inserted, error } = await sb.from('faculty').upsert({
            id: newFacId,
            user_id: userId,
            employee_id: `FAC-${userId.slice(0, 8).toUpperCase()}`,
            department: facultyUser?.department || 'Academic',
            designation: 'Faculty Professor'
        }, { onConflict: 'user_id' }).select('id').maybeSingle();
        if (!error && inserted?.id) {
            return inserted.id;
        }
        if (!error)
            return newFacId;
    }
    catch (err) {
        console.warn('[Academic Supabase] Error ensuring faculty record:', err.message);
    }
    return null;
}
// ============================================================================
// Bootstrap Institutional Academic Foundation
// ============================================================================
const bootstrapAcademicData = async () => {
    if (hasBootstrappedAcademic)
        return;
    hasBootstrappedAcademic = true;
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    await (0, supabaseSyncHelper_1.syncCloudTombstones)();
    if (sb) {
        try {
            const { data: supaDepts } = await sb.from('academic_departments').select('*').order('code');
            if (Array.isArray(supaDepts)) {
                const deptsStore = pool_1.db.getStore('departments');
                const supaDeptIds = new Set(supaDepts.map(d => d.id));
                const supaDeptCodes = new Set(supaDepts.map(d => (d.code || '').toUpperCase()));
                // Bidirectional purge: if deleted from Supabase, remove locally
                for (let i = deptsStore.length - 1; i >= 0; i--) {
                    const item = deptsStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.code) || (!supaDeptIds.has(item.id) && !supaDeptCodes.has((item.code || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'DEPARTMENT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
                        deptsStore.splice(i, 1);
                    }
                }
                for (const d of supaDepts) {
                    if (pool_1.db.isDeleted(d.id) || pool_1.db.isDeleted(d.code))
                        continue;
                    const existing = deptsStore.find(x => x.id === d.id || x.code.toUpperCase() === d.code.toUpperCase());
                    if (!existing) {
                        deptsStore.push({
                            id: d.id,
                            code: d.code,
                            name: d.name,
                            description: d.description || '',
                            createdAt: d.created_at || new Date().toISOString()
                        });
                    }
                }
            }
            const { data: supaCourses } = await sb.from('academic_courses').select('*').order('code');
            if (Array.isArray(supaCourses)) {
                const coursesStore = pool_1.db.getStore('courses');
                const deptsStore = pool_1.db.getStore('departments');
                const supaCourseIds = new Set(supaCourses.map(c => c.id));
                const supaCourseCodes = new Set(supaCourses.map(c => (c.code || '').toUpperCase()));
                // Bidirectional purge: if deleted from Supabase, remove locally
                for (let i = coursesStore.length - 1; i >= 0; i--) {
                    const item = coursesStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.code) || (!supaCourseIds.has(item.id) && !supaCourseCodes.has((item.code || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'COURSE', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
                        coursesStore.splice(i, 1);
                    }
                }
                for (const c of supaCourses) {
                    if (pool_1.db.isDeleted(c.id) || pool_1.db.isDeleted(c.code))
                        continue;
                    const deptObj = deptsStore.find(x => x.id === c.department_id);
                    const existing = coursesStore.find(x => x.id === c.id || x.code.toUpperCase() === c.code.toUpperCase());
                    if (!existing) {
                        coursesStore.push({
                            id: c.id,
                            code: c.code,
                            name: c.name,
                            departmentId: c.department_id,
                            departmentCode: deptObj ? deptObj.code : 'GEN',
                            degreeLevel: c.degree_level || 'Undergraduate',
                            createdAt: c.created_at || new Date().toISOString()
                        });
                    }
                }
            }
            const { data: supaSubs } = await sb.from('subjects').select('*').order('code');
            if (Array.isArray(supaSubs)) {
                const subsStore = pool_1.db.getStore('subjects');
                const deptsStore = pool_1.db.getStore('departments');
                const supaSubIds = new Set(supaSubs.map(s => s.id));
                const supaSubCodes = new Set(supaSubs.map(s => (s.code || '').toUpperCase()));
                for (let i = subsStore.length - 1; i >= 0; i--) {
                    const item = subsStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.code) || (!supaSubIds.has(item.id) && !supaSubCodes.has((item.code || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'SUBJECT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
                        subsStore.splice(i, 1);
                    }
                }
                for (const s of supaSubs) {
                    if (pool_1.db.isDeleted(s.id) || pool_1.db.isDeleted(s.code))
                        continue;
                    const deptObj = deptsStore.find(x => x.code === s.department);
                    const existing = subsStore.find(x => x.id === s.id || x.code.toUpperCase() === s.code.toUpperCase());
                    if (!existing) {
                        subsStore.push({
                            id: s.id,
                            code: s.code,
                            name: s.name,
                            departmentId: deptObj?.id,
                            departmentCode: s.department || 'GEN',
                            semester: s.semester,
                            credits: 2,
                            createdAt: s.created_at || new Date().toISOString()
                        });
                    }
                }
            }
            // Hydrate Academic Years from Supabase
            const { data: supaYears } = await sb.from('academic_years').select('*').order('year_code');
            if (Array.isArray(supaYears)) {
                const yearsStore = pool_1.db.getStore('academic_years');
                const supaYearIds = new Set(supaYears.map(y => y.id));
                const supaYearCodes = new Set(supaYears.map(y => (y.year_code || '').toUpperCase()));
                for (let i = yearsStore.length - 1; i >= 0; i--) {
                    const item = yearsStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.year) || (!supaYearIds.has(item.id) && !supaYearCodes.has((item.year || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'ACADEMIC_YEAR', { year: item.year, reason: 'DELETED_FROM_SUPABASE' });
                        yearsStore.splice(i, 1);
                    }
                }
                for (const y of supaYears) {
                    if (pool_1.db.isDeleted(y.id) || pool_1.db.isDeleted(y.year_code))
                        continue;
                    const existing = yearsStore.find(x => x.id === y.id || x.year.toUpperCase() === y.year_code.toUpperCase());
                    if (!existing) {
                        yearsStore.push({
                            id: y.id,
                            year: y.year_code,
                            isCurrent: Boolean(y.is_current),
                            startDate: y.start_date,
                            endDate: y.end_date,
                            createdAt: y.created_at || new Date().toISOString()
                        });
                    }
                }
            }
            // Hydrate Sections from Supabase system_settings / sections
            const { data: secSetting } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_sections').maybeSingle();
            if (secSetting && secSetting.setting_value) {
                try {
                    const parsedSecs = JSON.parse(secSetting.setting_value);
                    if (Array.isArray(parsedSecs)) {
                        const secStore = pool_1.db.getStore('sections');
                        secStore.length = 0;
                        for (const s of parsedSecs) {
                            if (pool_1.db.isDeleted(s.id) || pool_1.db.isDeleted(s.name))
                                continue;
                            secStore.push(s);
                        }
                    }
                }
                catch { }
            }
            // Hydrate Faculty Mapping for Foreign Key resolution
            const { data: supaFacultyList } = await sb.from('faculty').select('id, user_id');
            const facToUserMap = new Map((supaFacultyList || []).map((f) => [f.id, f.user_id]));
            // Hydrate Academic Classes from Supabase
            const { data: supaClasses } = await sb.from('academic_classes').select('*').order('name');
            if (Array.isArray(supaClasses)) {
                const classesStore = pool_1.db.getStore('classes');
                const labs = pool_1.db.getStore('labs');
                const users = pool_1.db.getStore('users');
                const supaClassIds = new Set(supaClasses.map(cl => cl.id));
                for (let i = classesStore.length - 1; i >= 0; i--) {
                    const item = classesStore[i];
                    if (pool_1.db.isDeleted(item.id) || !supaClassIds.has(item.id)) {
                        pool_1.db.recordDeletion(item.id, 'CLASS', { name: item.name, reason: 'DELETED_FROM_SUPABASE' });
                        classesStore.splice(i, 1);
                    }
                }
                for (const cl of supaClasses) {
                    if (pool_1.db.isDeleted(cl.id))
                        continue;
                    const courseObj = pool_1.db.findOne('courses', c => c.id === cl.course_id);
                    const subjectObj = pool_1.db.findOne('subjects', s => s.id === cl.subject_id);
                    const labObj = labs.find((l) => l.id === cl.default_lab_id || l.code === cl.default_lab_id);
                    const assignedUserId = facToUserMap.get(cl.faculty_id) || cl.faculty_id;
                    const assignedUser = assignedUserId ? users.find((u) => u.id === assignedUserId) : null;
                    const existing = classesStore.find(x => x.id === cl.id);
                    if (!existing) {
                        classesStore.push({
                            id: cl.id,
                            name: cl.name,
                            courseId: cl.course_id,
                            courseCode: courseObj ? courseObj.code : 'GEN',
                            subjectId: cl.subject_id,
                            subjectCode: subjectObj ? subjectObj.code : 'SUB',
                            subjectName: subjectObj ? subjectObj.name : cl.name,
                            academicYear: cl.academic_year || '2025-2026',
                            semester: cl.semester || 1,
                            section: cl.section || 'A',
                            defaultLabId: cl.default_lab_id,
                            defaultLabCode: labObj ? labObj.code : undefined,
                            assignedFacultyId: assignedUserId || undefined,
                            assignedFacultyName: assignedUser ? assignedUser.fullName : undefined,
                            enrollmentPolicy: 'DIRECT',
                            capacity: 40,
                            status: cl.status || 'ACTIVE',
                            createdAt: cl.created_at || new Date().toISOString()
                        });
                    }
                }
            }
            // Overlay cached class offerings metadata (e.g. capacity, enrollmentPolicy) from Supabase system_settings
            const { data: classCache } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_classes_cache').maybeSingle();
            if (classCache && classCache.setting_value) {
                try {
                    const cachedList = JSON.parse(classCache.setting_value);
                    if (Array.isArray(cachedList) && cachedList.length > 0) {
                        const classesStore = pool_1.db.getStore('classes');
                        for (const cItem of cachedList) {
                            if (pool_1.db.isDeleted(cItem.id))
                                continue;
                            const existing = classesStore.find((x) => x.id === cItem.id);
                            if (existing) {
                                if (cItem.capacity)
                                    existing.capacity = cItem.capacity;
                                if (cItem.enrollmentPolicy)
                                    existing.enrollmentPolicy = cItem.enrollmentPolicy;
                            }
                        }
                    }
                }
                catch { }
            }
            // Hydrate Students & Student Users from Supabase
            const { data: supaStudents } = await sb.from('students').select('*').order('created_at');
            if (Array.isArray(supaStudents)) {
                const studentsStore = pool_1.db.getStore('students');
                const supaStudentIds = new Set(supaStudents.map(s => s.id));
                const supaUserIds = new Set(supaStudents.map(s => s.user_id));
                for (let i = studentsStore.length - 1; i >= 0; i--) {
                    const item = studentsStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.userId) || (item.studentId && pool_1.db.isDeleted(item.studentId)) || (!supaStudentIds.has(item.id) && !supaUserIds.has(item.userId))) {
                        pool_1.db.recordDeletion(item.id, 'STUDENT', { studentId: item.studentId, reason: 'DELETED_FROM_SUPABASE' });
                        studentsStore.splice(i, 1);
                    }
                }
                for (const st of supaStudents) {
                    if (pool_1.db.isDeleted(st.id) || pool_1.db.isDeleted(st.user_id) || pool_1.db.isDeleted(st.student_id))
                        continue;
                    const existing = studentsStore.find(x => x.id === st.id || x.userId === st.user_id);
                    if (!existing) {
                        studentsStore.push({
                            id: st.id,
                            userId: st.user_id,
                            studentId: st.student_id,
                            department: st.department || 'General',
                            course: st.course || 'General',
                            yearOfStudy: st.year_of_study || 1,
                            semester: st.semester || 1,
                            section: st.section || 'A',
                            academicYear: '2026-2027',
                            rollNumber: st.roll_number || st.student_id,
                            createdAt: st.created_at || new Date().toISOString()
                        });
                    }
                }
            }
            // Hydrate Class Student Enrollments from Supabase
            const { data: supaClassStudents } = await sb.from('class_students').select('*');
            if (Array.isArray(supaClassStudents)) {
                const csStore = pool_1.db.getStore('class_students');
                csStore.length = 0;
                for (const cs of supaClassStudents) {
                    if (pool_1.db.isDeleted(cs.id) || pool_1.db.isDeleted(cs.student_id) || pool_1.db.isDeleted(cs.user_id) || pool_1.db.isDeleted(cs.class_id))
                        continue;
                    csStore.push({
                        id: cs.id,
                        classId: cs.class_id,
                        studentId: cs.student_id,
                        userId: cs.user_id,
                        enrolledAt: cs.enrolled_at || new Date().toISOString(),
                        status: cs.status || 'ACTIVE'
                    });
                }
            }
            // Academic sync completed
        }
        catch (err) {
            console.warn('[Academic Supabase] Cloud sync note:', err.message);
        }
    }
};
exports.bootstrapAcademicData = bootstrapAcademicData;
// Auto-run bootstrap once on startup
(0, exports.bootstrapAcademicData)();
// ============================================================================
// 1. Departments CRUD
// ============================================================================
const getDepartments = async (req, res) => {
    await (0, exports.bootstrapAcademicData)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaDepts, error } = await sb.from('academic_departments').select('*').order('code');
            if (!error && Array.isArray(supaDepts)) {
                const store = pool_1.db.getStore('departments');
                const supaIds = new Set(supaDepts.map((d) => d.id));
                const supaCodes = new Set(supaDepts.map((d) => (d.code || '').toUpperCase()));
                // Purge if deleted in Supabase
                for (let i = store.length - 1; i >= 0; i--) {
                    const item = store[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.code) || (!supaIds.has(item.id) && !supaCodes.has((item.code || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'DEPARTMENT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
                        store.splice(i, 1);
                    }
                }
                for (const d of supaDepts) {
                    if (pool_1.db.isDeleted(d.id) || pool_1.db.isDeleted(d.code))
                        continue;
                    const idx = store.findIndex((x) => x.id === d.id || x.code.toUpperCase() === d.code.toUpperCase());
                    const item = {
                        id: d.id,
                        code: d.code,
                        name: d.name,
                        description: d.description || '',
                        createdAt: d.created_at || new Date().toISOString()
                    };
                    if (idx >= 0) {
                        store[idx] = { ...store[idx], ...item };
                    }
                    else {
                        store.push(item);
                    }
                }
            }
        }
        catch (e) {
            console.warn('[Academic Supabase] getDepartments error:', e.message);
        }
    }
    const search = (req.query.search || '').toLowerCase().trim();
    let depts = pool_1.db.getStore('departments').filter(d => !pool_1.db.isDeleted(d.id) && !pool_1.db.isDeleted(d.code));
    if (search) {
        depts = depts.filter((d) => d.code.toLowerCase().includes(search) || d.name.toLowerCase().includes(search));
    }
    return res.json({ success: true, data: depts });
};
exports.getDepartments = getDepartments;
const createDepartment = async (req, res) => {
    const { code, name, description } = req.body;
    if (!code || !name) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Department Code and Name are required' });
    }
    const existing = pool_1.db.findOne('departments', (d) => d.code.toUpperCase() === code.trim().toUpperCase());
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Department code '${code}' already exists` });
    }
    const dept = {
        id: (0, uuid_1.v4)(),
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description ? description.trim() : undefined,
        createdAt: new Date().toISOString()
    };
    pool_1.db.insert('departments', dept);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_departments').upsert({
                id: dept.id,
                code: dept.code,
                name: dept.name,
                description: dept.description,
                created_at: dept.createdAt
            });
        }
        catch (e) {
            console.warn('[Academic Supabase] Insert department error:', e.message);
        }
    }
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
const updateDepartment = async (req, res) => {
    const { id } = req.params;
    const { code, name, description } = req.body;
    const dept = pool_1.db.findOne('departments', (d) => d.id === id);
    if (!dept) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Department not found' });
    }
    if (code && code.trim().toUpperCase() !== dept.code) {
        const existing = pool_1.db.findOne('departments', (d) => d.code.toUpperCase() === code.trim().toUpperCase() && d.id !== id);
        if (existing) {
            return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Department code '${code}' already exists` });
        }
        dept.code = code.trim().toUpperCase();
    }
    if (name)
        dept.name = name.trim();
    if (description !== undefined)
        dept.description = description.trim();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_departments').update({
                code: dept.code,
                name: dept.name,
                description: dept.description
            }).eq('id', id);
        }
        catch (e) {
            console.warn('[Academic Supabase] Update department error:', e.message);
        }
    }
    return res.json({ success: true, data: dept });
};
exports.updateDepartment = updateDepartment;
const deleteDepartment = async (req, res) => {
    const { id } = req.params;
    hasBootstrappedAcademic = true;
    const dept = pool_1.db.findOne('departments', (d) => d.id === id);
    if (!dept) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Department not found' });
    }
    // Cascade delete related courses and subjects from local store
    const courses = pool_1.db.getStore('courses');
    const subjects = pool_1.db.getStore('subjects');
    const classes = pool_1.db.getStore('classes');
    const relatedCourses = courses.filter((c) => c.departmentId === id || c.departmentCode === dept.code);
    const relatedCourseIds = new Set(relatedCourses.map(c => c.id));
    // Remove related classes
    const remainingClasses = classes.filter(cl => !relatedCourseIds.has(cl.courseId) && cl.courseCode !== dept.code);
    classes.length = 0;
    classes.push(...remainingClasses);
    // Remove related courses
    const remainingCourses = courses.filter((c) => c.departmentId !== id && c.departmentCode !== dept.code);
    courses.length = 0;
    courses.push(...remainingCourses);
    // Remove related subjects
    const remainingSubjects = subjects.filter((s) => s.departmentId !== id && s.departmentCode !== dept.code);
    subjects.length = 0;
    subjects.push(...remainingSubjects);
    // Remove department from local store
    const depts = pool_1.db.getStore('departments');
    const index = depts.findIndex((d) => d.id === id);
    if (index !== -1) {
        depts.splice(index, 1);
    }
    await (0, supabaseSyncHelper_1.recordCloudDeletion)(id, 'DEPARTMENT', { code: dept.code });
    pool_1.db.flush();
    // Remove from Supabase Cloud
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_courses').delete().eq('department_id', id);
            await sb.from('academic_departments').delete().eq('id', id);
        }
        catch (e) {
            console.warn('[Academic Supabase] Delete department error:', e.message);
        }
    }
    return res.json({ success: true, message: `Department '${dept.code}' and associated programs deleted successfully` });
};
exports.deleteDepartment = deleteDepartment;
// ============================================================================
// 2. Courses CRUD
// ============================================================================
const getCourses = async (req, res) => {
    await (0, exports.bootstrapAcademicData)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaCourses, error } = await sb.from('academic_courses').select('*').order('code');
            if (!error && Array.isArray(supaCourses)) {
                const depts = pool_1.db.getStore('departments');
                const coursesStore = pool_1.db.getStore('courses');
                const supaIds = new Set(supaCourses.map((c) => c.id));
                const supaCodes = new Set(supaCourses.map((c) => (c.code || '').toUpperCase()));
                // Purge if deleted in Supabase
                for (let i = coursesStore.length - 1; i >= 0; i--) {
                    const item = coursesStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.code) || (!supaIds.has(item.id) && !supaCodes.has((item.code || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'COURSE', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
                        coursesStore.splice(i, 1);
                    }
                }
                for (const c of supaCourses) {
                    if (pool_1.db.isDeleted(c.id) || pool_1.db.isDeleted(c.code))
                        continue;
                    const dept = depts.find((d) => d.id === c.department_id || d.code === c.department_id);
                    const idx = coursesStore.findIndex((x) => x.id === c.id || x.code.toUpperCase() === c.code.toUpperCase());
                    const courseItem = {
                        id: c.id,
                        code: c.code,
                        name: c.name,
                        departmentId: c.department_id,
                        departmentCode: dept ? dept.code : 'GEN',
                        degreeLevel: c.degree_level || 'Undergraduate',
                        createdAt: c.created_at || new Date().toISOString()
                    };
                    if (idx >= 0) {
                        coursesStore[idx] = { ...coursesStore[idx], ...courseItem };
                    }
                    else {
                        coursesStore.push(courseItem);
                    }
                }
            }
        }
        catch (e) {
            console.warn('[Academic Supabase] getCourses error:', e.message);
        }
    }
    const search = (req.query.search || '').toLowerCase().trim();
    const departmentId = req.query.departmentId;
    let courses = pool_1.db.getStore('courses').filter(c => !pool_1.db.isDeleted(c.id) && !pool_1.db.isDeleted(c.code));
    const depts = pool_1.db.getStore('departments');
    // Enhance courses with departmentCode if missing
    courses = courses.map((c) => {
        const d = depts.find((dept) => dept.id === c.departmentId || dept.code === c.departmentCode);
        return {
            ...c,
            departmentCode: d ? d.code : (c.departmentCode || 'GEN')
        };
    });
    if (departmentId) {
        courses = courses.filter((c) => c.departmentId === departmentId || c.departmentCode === departmentId);
    }
    if (search) {
        courses = courses.filter((c) => c.code.toLowerCase().includes(search) || c.name.toLowerCase().includes(search));
    }
    return res.json({ success: true, data: courses });
};
exports.getCourses = getCourses;
const createCourse = async (req, res) => {
    const { code, name, departmentId, degreeLevel } = req.body;
    if (!code || !name || !departmentId) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Course Code, Name, and Department are required' });
    }
    const dept = pool_1.db.findOne('departments', (d) => d.id === departmentId || d.code.toUpperCase() === departmentId.toUpperCase());
    if (!dept) {
        return res.status(400).json({ success: false, error: 'INVALID_DEPARTMENT', message: 'Specified Department does not exist' });
    }
    const existing = pool_1.db.findOne('courses', (c) => c.code.toUpperCase() === code.trim().toUpperCase());
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Course code '${code}' already exists` });
    }
    const course = {
        id: (0, uuid_1.v4)(),
        code: code.trim().toUpperCase(),
        name: name.trim(),
        departmentId: dept.id,
        departmentCode: dept.code,
        degreeLevel: degreeLevel || 'Undergraduate',
        createdAt: new Date().toISOString()
    };
    pool_1.db.insert('courses', course);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_courses').upsert({
                id: course.id,
                department_id: course.departmentId,
                code: course.code,
                name: course.name,
                degree_level: course.degreeLevel,
                created_at: course.createdAt
            });
        }
        catch (e) {
            console.warn('[Academic Supabase] Insert course error:', e.message);
        }
    }
    if (req.user) {
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: req.user.id,
            actorName: req.user.fullName,
            role: req.user.role,
            action: 'CREATE_COURSE',
            entityType: 'COURSE',
            entityId: course.id,
            timestamp: new Date().toISOString()
        });
    }
    return res.status(201).json({ success: true, data: course });
};
exports.createCourse = createCourse;
const updateCourse = async (req, res) => {
    const { id } = req.params;
    const { code, name, departmentId, degreeLevel } = req.body;
    const course = pool_1.db.findOne('courses', (c) => c.id === id);
    if (!course) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Course not found' });
    }
    if (code && code.trim().toUpperCase() !== course.code) {
        const existing = pool_1.db.findOne('courses', (c) => c.code.toUpperCase() === code.trim().toUpperCase() && c.id !== id);
        if (existing) {
            return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Course code '${code}' already exists` });
        }
        course.code = code.trim().toUpperCase();
    }
    if (departmentId && departmentId !== course.departmentId) {
        const dept = pool_1.db.findOne('departments', (d) => d.id === departmentId || d.code.toUpperCase() === departmentId.toUpperCase());
        if (!dept) {
            return res.status(400).json({ success: false, error: 'INVALID_DEPARTMENT', message: 'Department not found' });
        }
        course.departmentId = dept.id;
        course.departmentCode = dept.code;
    }
    if (name)
        course.name = name.trim();
    if (degreeLevel)
        course.degreeLevel = degreeLevel;
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_courses').update({
                code: course.code,
                name: course.name,
                department_id: course.departmentId,
                degree_level: course.degreeLevel
            }).eq('id', id);
        }
        catch (e) {
            console.warn('[Academic Supabase] Update course error:', e.message);
        }
    }
    if (req.user) {
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: req.user.id,
            actorName: req.user.fullName,
            role: req.user.role,
            action: 'UPDATE_COURSE',
            entityType: 'COURSE',
            entityId: course.id,
            timestamp: new Date().toISOString()
        });
    }
    return res.json({ success: true, data: course });
};
exports.updateCourse = updateCourse;
const deleteCourse = async (req, res) => {
    const { id } = req.params;
    hasBootstrappedAcademic = true;
    const course = pool_1.db.findOne('courses', (c) => c.id === id);
    if (!course) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Course not found' });
    }
    // Cascade clean classes tied to this course
    const classes = pool_1.db.getStore('classes');
    const remainingClasses = classes.filter((cl) => cl.courseId !== id && cl.courseCode !== course.code);
    classes.length = 0;
    classes.push(...remainingClasses);
    const courses = pool_1.db.getStore('courses');
    const index = courses.findIndex((c) => c.id === id);
    if (index !== -1)
        courses.splice(index, 1);
    await (0, supabaseSyncHelper_1.recordCloudDeletion)(id, 'COURSE', { code: course.code });
    pool_1.db.flush();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_courses').delete().eq('id', id);
        }
        catch (e) {
            console.warn('[Academic Supabase] Delete course error:', e.message);
        }
    }
    if (req.user) {
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: req.user.id,
            actorName: req.user.fullName,
            role: req.user.role,
            action: 'DELETE_COURSE',
            entityType: 'COURSE',
            entityId: id,
            timestamp: new Date().toISOString()
        });
    }
    return res.json({ success: true, message: `Course '${course.code}' deleted successfully` });
};
exports.deleteCourse = deleteCourse;
// ============================================================================
// 3. Subjects & Curriculum CRUD
// ============================================================================
const getSubjects = async (req, res) => {
    await (0, exports.bootstrapAcademicData)();
    const search = (req.query.search || '').toLowerCase().trim();
    const departmentId = req.query.departmentId;
    const semester = req.query.semester ? parseInt(req.query.semester) : undefined;
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaSubs, error } = await sb.from('subjects').select('*').order('code');
            if (!error && Array.isArray(supaSubs)) {
                const subsStore = pool_1.db.getStore('subjects');
                const depts = pool_1.db.getStore('departments');
                const supaIds = new Set(supaSubs.map((s) => s.id));
                const supaCodes = new Set(supaSubs.map((s) => (s.code || '').toUpperCase()));
                // Purge if deleted in Supabase
                for (let i = subsStore.length - 1; i >= 0; i--) {
                    const item = subsStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.code) || (!supaIds.has(item.id) && !supaCodes.has((item.code || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'SUBJECT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
                        subsStore.splice(i, 1);
                    }
                }
                for (const s of supaSubs) {
                    if (pool_1.db.isDeleted(s.id) || pool_1.db.isDeleted(s.code))
                        continue;
                    const deptObj = depts.find((d) => d.code === s.department || d.id === s.department_id);
                    const idx = subsStore.findIndex((x) => x.id === s.id || x.code.toUpperCase() === s.code.toUpperCase());
                    const item = {
                        id: s.id,
                        code: s.code,
                        name: s.name,
                        departmentId: deptObj ? deptObj.id : undefined,
                        departmentCode: s.department || (deptObj ? deptObj.code : 'GEN'),
                        semester: s.semester,
                        credits: 2,
                        createdAt: s.created_at || new Date().toISOString()
                    };
                    if (idx >= 0) {
                        subsStore[idx] = { ...subsStore[idx], ...item };
                    }
                    else {
                        subsStore.push(item);
                    }
                }
            }
        }
        catch (err) {
            console.warn('[Subjects Supabase] Fetch error:', err.message);
        }
    }
    let subjects = pool_1.db.getStore('subjects').filter(s => !pool_1.db.isDeleted(s.id) && !pool_1.db.isDeleted(s.code));
    const depts = pool_1.db.getStore('departments');
    subjects = subjects.map((s) => {
        const d = depts.find((dept) => dept.id === s.departmentId || dept.code === s.departmentCode);
        return {
            ...s,
            departmentCode: d ? d.code : (s.departmentCode || 'GEN')
        };
    });
    if (departmentId) {
        subjects = subjects.filter((s) => s.departmentId === departmentId || s.departmentCode === departmentId);
    }
    if (semester) {
        subjects = subjects.filter((s) => s.semester === semester);
    }
    if (search) {
        subjects = subjects.filter((s) => s.code.toLowerCase().includes(search) || s.name.toLowerCase().includes(search));
    }
    return res.json({ success: true, data: subjects });
};
exports.getSubjects = getSubjects;
const createSubject = async (req, res) => {
    const { code, name, departmentId, semester, credits } = req.body;
    if (!code || !name || !semester) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Subject Code, Name, and Semester are required' });
    }
    const existing = pool_1.db.findOne('subjects', (s) => s.code.toUpperCase() === code.trim().toUpperCase());
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Subject code '${code}' already exists` });
    }
    let deptCode = 'GEN';
    if (departmentId) {
        const dept = pool_1.db.findOne('departments', (d) => d.id === departmentId);
        if (dept)
            deptCode = dept.code;
    }
    const subject = {
        id: (0, uuid_1.v4)(),
        code: code.trim().toUpperCase(),
        name: name.trim(),
        departmentId,
        departmentCode: deptCode,
        semester: Number(semester),
        credits: credits ? Number(credits) : 2,
        createdAt: new Date().toISOString()
    };
    pool_1.db.insert('subjects', subject);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('subjects').upsert({
                id: subject.id,
                code: subject.code,
                name: subject.name,
                department: deptCode,
                semester: subject.semester,
                created_at: subject.createdAt
            }, { onConflict: 'id' });
        }
        catch (err) {
            console.warn('[Subjects Supabase] Create error:', err.message);
        }
    }
    return res.status(201).json({ success: true, data: subject });
};
exports.createSubject = createSubject;
const updateSubject = async (req, res) => {
    const { id } = req.params;
    const { code, name, departmentId, semester, credits } = req.body;
    const subject = pool_1.db.findOne('subjects', (s) => s.id === id);
    if (!subject) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Subject not found' });
    }
    if (code && code.trim().toUpperCase() !== subject.code) {
        const existing = pool_1.db.findOne('subjects', (s) => s.code.toUpperCase() === code.trim().toUpperCase() && s.id !== id);
        if (existing) {
            return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Subject code '${code}' already exists` });
        }
        subject.code = code.trim().toUpperCase();
    }
    if (departmentId) {
        const dept = pool_1.db.findOne('departments', (d) => d.id === departmentId);
        subject.departmentId = departmentId;
        if (dept)
            subject.departmentCode = dept.code;
    }
    if (name)
        subject.name = name.trim();
    if (semester)
        subject.semester = Number(semester);
    if (credits !== undefined)
        subject.credits = Number(credits);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('subjects').update({
                code: subject.code,
                name: subject.name,
                department: subject.departmentCode,
                semester: subject.semester
            }).eq('id', id);
        }
        catch (err) {
            console.warn('[Subjects Supabase] Update error:', err.message);
        }
    }
    return res.json({ success: true, data: subject });
};
exports.updateSubject = updateSubject;
const deleteSubject = async (req, res) => {
    const { id } = req.params;
    const subject = pool_1.db.findOne('subjects', (s) => s.id === id);
    if (!subject) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Subject not found' });
    }
    // Dependency Check: Block deletion if referenced by classes
    const relatedClasses = pool_1.db.find('classes', (cl) => cl.subjectId === id || cl.subjectCode === subject.code);
    if (relatedClasses.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'CANNOT_DELETE_HAS_DEPENDENCIES',
            message: `Cannot delete subject '${subject.code}' because it is referenced by ${relatedClasses.length} active class offering(s).`
        });
    }
    const subjects = pool_1.db.getStore('subjects');
    const index = subjects.findIndex((s) => s.id === id);
    if (index !== -1)
        subjects.splice(index, 1);
    await (0, supabaseSyncHelper_1.recordCloudDeletion)(id, 'SUBJECT', { code: subject.code });
    pool_1.db.flush();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('subjects').delete().eq('id', id);
        }
        catch (err) {
            console.warn('[Subjects Supabase] Delete error:', err.message);
        }
    }
    return res.json({ success: true, message: `Subject '${subject.code}' deleted successfully` });
};
exports.deleteSubject = deleteSubject;
// ============================================================================
// 4. Academic Years CRUD
// ============================================================================
const getAcademicYears = async (_req, res) => {
    await (0, exports.bootstrapAcademicData)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaYears, error } = await sb.from('academic_years').select('*').order('year_code');
            if (!error && Array.isArray(supaYears)) {
                const yearsStore = pool_1.db.getStore('academic_years');
                const supaIds = new Set(supaYears.map((y) => y.id));
                const supaCodes = new Set(supaYears.map((y) => (y.year_code || '').toUpperCase()));
                // Purge if deleted in Supabase
                for (let i = yearsStore.length - 1; i >= 0; i--) {
                    const item = yearsStore[i];
                    if (pool_1.db.isDeleted(item.id) || pool_1.db.isDeleted(item.year) || (!supaIds.has(item.id) && !supaCodes.has((item.year || '').toUpperCase()))) {
                        pool_1.db.recordDeletion(item.id, 'ACADEMIC_YEAR', { year: item.year, reason: 'DELETED_FROM_SUPABASE' });
                        yearsStore.splice(i, 1);
                    }
                }
                for (const y of supaYears) {
                    if (pool_1.db.isDeleted(y.id) || pool_1.db.isDeleted(y.year_code))
                        continue;
                    const idx = yearsStore.findIndex((x) => x.id === y.id || x.year.toUpperCase() === y.year_code.toUpperCase());
                    const item = {
                        id: y.id,
                        year: y.year_code,
                        isCurrent: Boolean(y.is_current),
                        startDate: y.start_date,
                        endDate: y.end_date,
                        createdAt: y.created_at || new Date().toISOString()
                    };
                    if (idx >= 0) {
                        yearsStore[idx] = { ...yearsStore[idx], ...item };
                    }
                    else {
                        yearsStore.push(item);
                    }
                }
            }
        }
        catch (e) {
            console.warn('[Academic Supabase] Fetch years error:', e.message);
        }
    }
    const years = pool_1.db.getStore('academic_years').filter(y => !pool_1.db.isDeleted(y.id) && !pool_1.db.isDeleted(y.year));
    return res.json({ success: true, data: years });
};
exports.getAcademicYears = getAcademicYears;
const createAcademicYear = async (req, res) => {
    const { year, isCurrent, startDate, endDate } = req.body;
    if (!year) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Academic Year string (e.g. 2026-2027) is required' });
    }
    const existing = pool_1.db.findOne('academic_years', (y) => y.year.trim() === year.trim());
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_YEAR', message: `Academic Year '${year}' already exists` });
    }
    // Multi-active sessions: do NOT uncheck other sessions; allow multiple active sessions concurrently!
    const newYear = {
        id: (0, uuid_1.v4)(),
        year: year.trim(),
        isCurrent: Boolean(isCurrent),
        startDate: startDate || '2025-08-01',
        endDate: endDate || '2026-05-31',
        createdAt: new Date().toISOString()
    };
    pool_1.db.insert('academic_years', newYear);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_years').upsert({
                id: newYear.id,
                year_code: newYear.year,
                is_current: newYear.isCurrent,
                start_date: newYear.startDate,
                end_date: newYear.endDate,
                created_at: newYear.createdAt
            }, { onConflict: 'id' });
        }
        catch (e) {
            console.warn('[Academic Supabase] Insert year error:', e.message);
        }
    }
    return res.status(201).json({ success: true, data: newYear });
};
exports.createAcademicYear = createAcademicYear;
const updateAcademicYear = async (req, res) => {
    const { id } = req.params;
    const { year, isCurrent, startDate, endDate } = req.body;
    const y = pool_1.db.findOne('academic_years', (item) => item.id === id);
    if (!y) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Academic Year not found' });
    }
    if (year && year.trim() !== y.year) {
        const existing = pool_1.db.findOne('academic_years', (item) => item.year === year.trim() && item.id !== id);
        if (existing) {
            return res.status(409).json({ success: false, error: 'DUPLICATE_YEAR', message: `Academic Year '${year}' already exists` });
        }
        y.year = year.trim();
    }
    // Multi-active sessions: allow toggling isCurrent without clearing other sessions!
    if (isCurrent !== undefined) {
        y.isCurrent = Boolean(isCurrent);
    }
    if (startDate !== undefined)
        y.startDate = startDate;
    if (endDate !== undefined)
        y.endDate = endDate;
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_years').update({
                year_code: y.year,
                is_current: y.isCurrent,
                start_date: y.startDate,
                end_date: y.endDate
            }).eq('id', id);
        }
        catch (e) {
            console.warn('[Academic Supabase] Update year error:', e.message);
        }
    }
    return res.json({ success: true, data: y });
};
exports.updateAcademicYear = updateAcademicYear;
const deleteAcademicYear = async (req, res) => {
    const { id } = req.params;
    const y = pool_1.db.findOne('academic_years', (item) => item.id === id);
    if (!y) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Academic Year not found' });
    }
    // Dependency Check
    const relatedClasses = pool_1.db.find('classes', (cl) => cl.academicYear === y.year);
    if (relatedClasses.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'CANNOT_DELETE_HAS_DEPENDENCIES',
            message: `Cannot delete Academic Year '${y.year}' because it is referenced by ${relatedClasses.length} class offering(s).`
        });
    }
    const years = pool_1.db.getStore('academic_years');
    const index = years.findIndex((item) => item.id === id);
    if (index !== -1)
        years.splice(index, 1);
    await (0, supabaseSyncHelper_1.recordCloudDeletion)(id, 'ACADEMIC_YEAR', { year: y.year });
    pool_1.db.flush();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('academic_years').delete().eq('id', id);
        }
        catch (e) {
            console.warn('[Academic Supabase] Delete year error:', e.message);
        }
    }
    return res.json({ success: true, message: `Academic Year '${y.year}' deleted successfully` });
};
exports.deleteAcademicYear = deleteAcademicYear;
// ============================================================================
// 5. Sections CRUD
// ============================================================================
const getSections = async (_req, res) => {
    await (0, exports.bootstrapAcademicData)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: secSetting } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_sections').maybeSingle();
            if (secSetting && secSetting.setting_value) {
                const parsed = JSON.parse(secSetting.setting_value);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const secStore = pool_1.db.getStore('sections');
                    secStore.length = 0;
                    secStore.push(...parsed);
                }
            }
        }
        catch { }
    }
    const sections = pool_1.db.getStore('sections');
    return res.json({ success: true, data: sections });
};
exports.getSections = getSections;
const createSection = async (req, res) => {
    const { name, courseId, semester } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Section name (e.g. A, B, C) is required' });
    }
    const cleanName = name.trim().toUpperCase();
    const existing = pool_1.db.findOne('sections', (s) => s.name.toUpperCase() === cleanName);
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_SECTION', message: `Section '${cleanName}' already exists` });
    }
    const section = {
        id: (0, uuid_1.v4)(),
        name: cleanName,
        courseId,
        semester: semester ? Number(semester) : undefined,
        createdAt: new Date().toISOString()
    };
    pool_1.db.insert('sections', section);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const secStore = pool_1.db.getStore('sections');
            await sb.from('system_settings').upsert({
                setting_key: 'academic_sections',
                setting_value: JSON.stringify(secStore),
                description: 'Persistent list of institutional sections',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        catch (e) {
            console.warn('[Academic Supabase] Save sections error:', e.message);
        }
    }
    return res.status(201).json({ success: true, data: section });
};
exports.createSection = createSection;
const deleteSection = async (req, res) => {
    const { id } = req.params;
    const section = pool_1.db.findOne('sections', (s) => s.id === id);
    if (!section) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Section not found' });
    }
    // Dependency Check
    const relatedClasses = pool_1.db.find('classes', (cl) => cl.section === section.name);
    if (relatedClasses.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'CANNOT_DELETE_HAS_DEPENDENCIES',
            message: `Cannot delete section '${section.name}' because it is referenced by ${relatedClasses.length} class offering(s).`
        });
    }
    const sections = pool_1.db.getStore('sections');
    const index = sections.findIndex((s) => s.id === id);
    if (index !== -1)
        sections.splice(index, 1);
    await (0, supabaseSyncHelper_1.recordCloudDeletion)(id, 'SECTION', { name: section.name });
    pool_1.db.flush();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('system_settings').upsert({
                setting_key: 'academic_sections',
                setting_value: JSON.stringify(sections.filter(s => !pool_1.db.isDeleted(s.id) && !pool_1.db.isDeleted(s.name))),
                description: 'Persistent list of institutional sections',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        catch (e) {
            console.warn('[Academic Supabase] Delete section error:', e.message);
        }
    }
    return res.json({ success: true, message: `Section '${section.name}' deleted successfully` });
};
exports.deleteSection = deleteSection;
// ============================================================================
// 6. Academic Classes CRUD
// ============================================================================
const getClasses = async (req, res) => {
    await (0, exports.bootstrapAcademicData)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaClasses, error } = await sb.from('academic_classes').select('*').order('name');
            if (!error && Array.isArray(supaClasses)) {
                const classesStore = pool_1.db.getStore('classes');
                const supaClassIds = new Set(supaClasses.map((cl) => cl.id));
                for (let i = classesStore.length - 1; i >= 0; i--) {
                    const item = classesStore[i];
                    if (pool_1.db.isDeleted(item.id) || !supaClassIds.has(item.id)) {
                        pool_1.db.recordDeletion(item.id, 'CLASS', { name: item.name, reason: 'DELETED_FROM_SUPABASE' });
                        classesStore.splice(i, 1);
                    }
                }
            }
        }
        catch { }
    }
    const user = req.user;
    let classes = pool_1.db.getStore('classes').filter(c => !pool_1.db.isDeleted(c.id));
    const courses = pool_1.db.getStore('courses');
    const subjects = pool_1.db.getStore('subjects');
    const users = pool_1.db.getStore('users');
    const labs = pool_1.db.getStore('labs');
    // Enhance classes with human-readable joins
    classes = classes.map((cl) => {
        const course = courses.find((c) => c.id === cl.courseId || c.code === cl.courseCode);
        const subject = subjects.find((s) => s.id === cl.subjectId || s.code === cl.subjectCode);
        const faculty = users.find((u) => u.id === cl.assignedFacultyId);
        const lab = labs.find((l) => l.id === cl.defaultLabId || l.code === cl.defaultLabCode);
        const classStudents = pool_1.db.getStore('class_students');
        const enrolled = classStudents.filter((cs) => cs.classId === cl.id && cs.status === 'ACTIVE').length;
        return {
            ...cl,
            courseCode: course ? course.code : cl.courseCode,
            subjectCode: subject ? subject.code : cl.subjectCode,
            subjectName: subject ? subject.name : cl.subjectName,
            assignedFacultyName: faculty ? faculty.fullName : cl.assignedFacultyName,
            defaultLabCode: lab ? lab.code : cl.defaultLabCode,
            enrollmentPolicy: cl.enrollmentPolicy || (course?.enrollmentPolicy) || 'DIRECT',
            enrolledCount: enrolled,
            capacity: cl.capacity || 40
        };
    });
    // Server-side scoping: Faculty only sees assigned classes
    if (user.role === 'FACULTY') {
        classes = classes.filter((c) => c.assignedFacultyId === user.id);
    }
    const search = (req.query.search || '').toLowerCase().trim();
    if (search) {
        classes = classes.filter((cl) => (cl.name && cl.name.toLowerCase().includes(search)) ||
            (cl.courseCode && cl.courseCode.toLowerCase().includes(search)) ||
            (cl.subjectCode && cl.subjectCode.toLowerCase().includes(search)) ||
            (cl.assignedFacultyName && cl.assignedFacultyName.toLowerCase().includes(search)));
    }
    return res.json({ success: true, data: classes });
};
exports.getClasses = getClasses;
const createClass = async (req, res) => {
    const { name, courseId, subjectId, academicYear, semester, section, defaultLabId, defaultLabCode, assignedFacultyId, enrollmentPolicy, capacity } = req.body;
    if (!courseId || !subjectId || !academicYear || !semester || !section) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Course, Subject, Academic Year, Semester, and Section are required'
        });
    }
    const course = pool_1.db.findOne('courses', (c) => c.id === courseId || c.code === courseId);
    if (!course) {
        return res.status(400).json({ success: false, error: 'INVALID_COURSE', message: 'Course not found' });
    }
    const subject = pool_1.db.findOne('subjects', (s) => s.id === subjectId || s.code === subjectId);
    if (!subject) {
        return res.status(400).json({ success: false, error: 'INVALID_SUBJECT', message: 'Subject not found' });
    }
    // Prevent duplicate offering for same course, subject, year, semester, section
    const existing = pool_1.db.findOne('classes', (cl) => (cl.courseId === course.id || cl.courseCode === course.code) &&
        (cl.subjectId === subject.id || cl.subjectCode === subject.code) &&
        cl.academicYear === academicYear &&
        cl.semester === Number(semester) &&
        cl.section === section.trim().toUpperCase());
    if (existing) {
        return res.status(409).json({
            success: false,
            error: 'DUPLICATE_CLASS_OFFERING',
            message: `A class offering already exists for ${course.code} - ${subject.code} (${academicYear} Sem ${semester} Sec ${section})`
        });
    }
    let facultyName = '';
    if (assignedFacultyId) {
        const facultyUser = pool_1.db.findOne('users', (u) => u.id === assignedFacultyId);
        if (facultyUser)
            facultyName = facultyUser.fullName;
    }
    let finalLabCode = defaultLabCode;
    if (defaultLabId && !finalLabCode) {
        const lab = pool_1.db.findOne('labs', (l) => l.id === defaultLabId);
        if (lab)
            finalLabCode = lab.code;
    }
    const className = name && name.trim() ? name.trim() : `${subject.name} (Sec ${section.toUpperCase()})`;
    const newClass = {
        id: (0, uuid_1.v4)(),
        name: className,
        courseId: course.id,
        courseCode: course.code,
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        academicYear: academicYear.trim(),
        semester: Number(semester),
        section: section.trim().toUpperCase(),
        defaultLabId,
        defaultLabCode: finalLabCode,
        assignedFacultyId,
        assignedFacultyName: facultyName || undefined,
        enrollmentPolicy: enrollmentPolicy || course.enrollmentPolicy || 'DIRECT',
        capacity: capacity ? Number(capacity) : 40,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
    };
    pool_1.db.insert('classes', newClass);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            let supaFacultyId = null;
            if (assignedFacultyId) {
                supaFacultyId = await ensureFacultySupabaseId(assignedFacultyId);
            }
            let supaLabId = defaultLabId || null;
            if (finalLabCode && !supaLabId) {
                const labObj = pool_1.db.findOne('labs', (l) => l.code === finalLabCode);
                if (labObj)
                    supaLabId = labObj.id;
            }
            await sb.from('academic_classes').upsert({
                id: newClass.id,
                course_id: course.id,
                subject_id: subject.id,
                department_id: course.departmentId,
                faculty_id: supaFacultyId || null,
                default_lab_id: supaLabId || null,
                name: newClass.name,
                academic_year: newClass.academicYear,
                year_of_study: 1,
                semester: newClass.semester,
                section: newClass.section,
                status: newClass.status,
                created_at: newClass.createdAt
            }, { onConflict: 'id' });
            const allClasses = pool_1.db.getStore('classes');
            await sb.from('system_settings').upsert({
                setting_key: 'academic_classes_cache',
                setting_value: JSON.stringify(allClasses),
                description: 'Cache of academic classes offerings with full metadata',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        catch (err) {
            console.warn('[Classes Supabase] Create class error:', err.message);
        }
    }
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: req.user.id,
        actorName: req.user.fullName,
        role: req.user.role,
        action: 'CREATE_CLASS_OFFERING',
        entityType: 'CLASS',
        entityId: newClass.id,
        timestamp: new Date().toISOString()
    });
    return res.status(201).json({ success: true, data: newClass });
};
exports.createClass = createClass;
const updateClass = async (req, res) => {
    const { id } = req.params;
    const { name, courseId, subjectId, academicYear, semester, section, defaultLabCode, assignedFacultyId, status, enrollmentPolicy, capacity } = req.body;
    const cl = pool_1.db.findOne('classes', (item) => item.id === id);
    if (!cl) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class offering not found' });
    }
    if (courseId) {
        const course = pool_1.db.findOne('courses', (c) => c.id === courseId || c.code === courseId);
        if (course) {
            cl.courseId = course.id;
            cl.courseCode = course.code;
        }
    }
    if (subjectId) {
        const subject = pool_1.db.findOne('subjects', (s) => s.id === subjectId || s.code === subjectId);
        if (subject) {
            cl.subjectId = subject.id;
            cl.subjectCode = subject.code;
            cl.subjectName = subject.name;
        }
    }
    if (name)
        cl.name = name.trim();
    if (academicYear)
        cl.academicYear = academicYear.trim();
    if (semester)
        cl.semester = Number(semester);
    if (section)
        cl.section = section.trim().toUpperCase();
    if (defaultLabCode !== undefined)
        cl.defaultLabCode = defaultLabCode;
    if (status)
        cl.status = status;
    if (enrollmentPolicy !== undefined)
        cl.enrollmentPolicy = enrollmentPolicy;
    if (capacity !== undefined)
        cl.capacity = Number(capacity);
    if (assignedFacultyId !== undefined) {
        cl.assignedFacultyId = assignedFacultyId;
        if (assignedFacultyId) {
            const facultyUser = pool_1.db.findOne('users', (u) => u.id === assignedFacultyId);
            cl.assignedFacultyName = facultyUser ? facultyUser.fullName : undefined;
        }
        else {
            cl.assignedFacultyName = undefined;
        }
    }
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            let supaFacultyId = null;
            if (cl.assignedFacultyId) {
                supaFacultyId = await ensureFacultySupabaseId(cl.assignedFacultyId);
            }
            let supaLabId = cl.defaultLabId || null;
            if (cl.defaultLabCode && !supaLabId) {
                const labObj = pool_1.db.findOne('labs', (l) => l.code === cl.defaultLabCode);
                if (labObj)
                    supaLabId = labObj.id;
            }
            await sb.from('academic_classes').update({
                name: cl.name,
                academic_year: cl.academicYear,
                semester: cl.semester,
                section: cl.section,
                status: cl.status,
                faculty_id: supaFacultyId || null,
                default_lab_id: supaLabId || null
            }).eq('id', id);
            const allClasses = pool_1.db.getStore('classes');
            await sb.from('system_settings').upsert({
                setting_key: 'academic_classes_cache',
                setting_value: JSON.stringify(allClasses),
                description: 'Cache of academic classes offerings with full metadata',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        catch (err) {
            console.warn('[Classes Supabase] Update class error:', err.message);
        }
    }
    return res.json({ success: true, data: cl });
};
exports.updateClass = updateClass;
const deleteClass = async (req, res) => {
    const { id } = req.params;
    hasBootstrappedAcademic = true;
    const cl = pool_1.db.findOne('classes', (item) => item.id === id);
    if (!cl) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class offering not found' });
    }
    pool_1.db.delete('classes', (item) => item.id === id);
    await (0, supabaseSyncHelper_1.recordCloudDeletion)(id, 'CLASS', { name: cl.name });
    pool_1.db.flush();
    // Cascade delete in-memory class student assignments
    pool_1.db.delete('class_students', (cs) => cs.classId === id);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('student_class_assignments').delete().eq('class_id', id);
            await sb.from('academic_classes').delete().eq('id', id);
            const allClasses = pool_1.db.getStore('classes').filter((c) => !pool_1.db.isDeleted(c.id));
            await sb.from('system_settings').upsert({
                setting_key: 'academic_classes_cache',
                setting_value: JSON.stringify(allClasses),
                description: 'Cache of academic classes offerings with full metadata',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        catch (e) {
            console.warn('[Classes Supabase] Delete error:', e.message);
        }
    }
    return res.json({ success: true, message: `Class offering '${cl.name}' deleted successfully` });
};
exports.deleteClass = deleteClass;
// ============================================================================
// 7. Student Profiles & Enrollment
// ============================================================================
const getStudents = async (req, res) => {
    const user = req.user;
    const students = pool_1.db.getStore('students');
    const users = pool_1.db.getStore('users');
    const classStudents = pool_1.db.getStore('class_students');
    const classes = pool_1.db.getStore('classes');
    // Join students with user details
    let joined = students.map((s) => {
        const u = users.find((usr) => usr.id === s.userId);
        return {
            ...s,
            fullName: u ? u.fullName : 'Unknown',
            email: u ? u.email : '',
            isActive: u ? u.isActive : true,
            assignedLabs: u?.assignedLabs || []
        };
    });
    const { classId, search, course, section } = req.query;
    if (classId) {
        const enrolledInClass = new Set(classStudents.filter((cs) => cs.classId === classId && cs.status === 'ACTIVE').map((cs) => cs.userId));
        const targetClass = classes.find((c) => c.id === classId);
        joined = joined.filter((s) => enrolledInClass.has(s.userId) || (targetClass && s.course === targetClass.courseCode && s.section === targetClass.section));
    }
    if (course) {
        joined = joined.filter((s) => s.course?.toUpperCase() === course.toUpperCase());
    }
    if (section) {
        joined = joined.filter((s) => s.section?.toUpperCase() === section.toUpperCase());
    }
    if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        joined = joined.filter((s) => s.studentId?.toLowerCase().includes(q) ||
            s.identifier?.toLowerCase().includes(q) ||
            s.fullName?.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q) ||
            s.department?.toLowerCase().includes(q) ||
            s.course?.toLowerCase().includes(q) ||
            s.section?.toLowerCase().includes(q) ||
            (s.phone && s.phone.toLowerCase().includes(q)));
    }
    // Student can only see self
    if (user.role === 'STUDENT') {
        const self = joined.filter((s) => s.userId === user.id);
        return res.json({ success: true, data: self });
    }
    return res.json({ success: true, data: joined });
};
exports.getStudents = getStudents;
const enrollStudent = async (req, res) => {
    const { studentId, fullName, dateOfBirth, gender, email, phone, department, course, yearOfStudy, semester, section, academicYear, authorizedLabs, password, classId } = req.body;
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
    const finalLabs = authorizedLabs || [];
    if (classId) {
        const targetClass = pool_1.db.findOne('classes', (c) => c.id === classId);
        if (targetClass?.defaultLabCode && !finalLabs.includes(targetClass.defaultLabCode)) {
            finalLabs.push(targetClass.defaultLabCode);
        }
    }
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
        assignedLabs: finalLabs,
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
    // If classId specified, directly link to class
    if (classId) {
        pool_1.db.insert('class_students', {
            id: (0, uuid_1.v4)(),
            classId,
            studentId,
            userId,
            enrolledAt: new Date().toISOString(),
            enrolledByUserId: req.user.id,
            status: 'ACTIVE'
        });
    }
    // Two-way Supabase Cloud Synchronization: Persist user & student immediately
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('users').upsert({
                id: userId,
                email,
                password_hash: passwordHash,
                full_name: fullName,
                role_id: '10000000-0000-0000-0000-000000000004',
                phone: phone || null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' });
            await sb.from('students').upsert({
                id: studentProfile.id,
                user_id: userId,
                student_id: studentId,
                department: department || 'General',
                course: course || 'General',
                year_of_study: Number(yearOfStudy) || 1,
                semester: Number(semester) || 1,
                section: section || 'A',
                admission_year: new Date().getFullYear(),
                roll_number: studentId,
                created_at: studentProfile.createdAt
            }, { onConflict: 'student_id' });
            if (classId) {
                await sb.from('class_students').upsert({
                    id: (0, uuid_1.v4)(),
                    class_id: classId,
                    student_id: studentProfile.id,
                    user_id: userId,
                    enrolled_at: new Date().toISOString(),
                    enrolled_by_user_id: req.user.id,
                    status: 'ACTIVE'
                }, { onConflict: 'id' });
            }
        }
        catch (err) {
            console.warn('[EnrollStudent Supabase] Direct sync error:', err.message);
        }
    }
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
/**
 * POST /api/classes/:id/enroll
 * Enroll existing student into a class with policy evaluation (DIRECT vs APPROVAL_REQUIRED).
 */
const enrollStudentInClass = async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { studentIdentifier, studentId, notes } = req.body;
    const targetId = studentIdentifier || studentId;
    if (!targetId) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Student identifier or ID is required' });
    }
    const classItem = pool_1.db.findOne('classes', (c) => c.id === id);
    if (!classItem) {
        return res.status(404).json({ success: false, error: 'CLASS_NOT_FOUND', message: 'Class offering not found' });
    }
    const student = pool_1.db.findOne('students', (s) => s.id === targetId ||
        s.userId === targetId ||
        s.studentId.toUpperCase() === String(targetId).toUpperCase());
    if (!student) {
        return res.status(404).json({ success: false, error: 'STUDENT_NOT_FOUND', message: 'Student profile not found' });
    }
    const studentUser = pool_1.db.findOne('users', (u) => u.id === student.userId);
    // Check if already enrolled in this class
    const classStudents = pool_1.db.getStore('class_students');
    const alreadyEnrolled = classStudents.find((cs) => cs.classId === classItem.id && (cs.userId === student.userId || cs.studentId.toUpperCase() === student.studentId.toUpperCase()) && cs.status === 'ACTIVE');
    if (alreadyEnrolled) {
        return res.status(409).json({ success: false, error: 'ALREADY_ENROLLED', message: `Student '${student.studentId}' is already enrolled in '${classItem.name}'` });
    }
    const policy = classItem.enrollmentPolicy || 'DIRECT';
    if (policy === 'APPROVAL_REQUIRED' && user.role !== 'ADMIN') {
        const existingReq = pool_1.db.findOne('enrollment_requests', (er) => er.classId === classItem.id && er.studentUserId === student.userId && er.status === 'PENDING');
        if (existingReq) {
            return res.status(409).json({
                success: false,
                error: 'PENDING_REQUEST_EXISTS',
                message: 'A pending enrollment request already exists for this student and class offering'
            });
        }
        const newRequest = {
            id: (0, uuid_1.v4)(),
            studentId: student.studentId,
            studentUserId: student.userId,
            studentName: studentUser?.fullName || student.studentId,
            classId: classItem.id,
            className: classItem.name || 'Class Offering',
            courseCode: classItem.courseCode || 'N/A',
            section: classItem.section,
            policy: 'APPROVAL_REQUIRED',
            requestedByUserId: user.id,
            requestedByUserName: user.fullName,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        pool_1.db.insert('enrollment_requests', newRequest);
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: user.id,
            actorName: user.fullName,
            role: user.role,
            action: 'ENROLLMENT_REQUEST_CREATED',
            entityType: 'ENROLLMENT_REQUEST',
            entityId: newRequest.id,
            timestamp: new Date().toISOString()
        });
        return res.status(202).json({
            success: true,
            status: 'PENDING_APPROVAL',
            policy: 'APPROVAL_REQUIRED',
            data: newRequest,
            message: `Enrollment request submitted for Administrator review (Class '${classItem.name}' policy requires approval).`
        });
    }
    // DIRECT enrollment
    const newEnrollment = {
        id: (0, uuid_1.v4)(),
        classId: classItem.id,
        studentId: student.studentId,
        userId: student.userId,
        enrolledAt: new Date().toISOString(),
        enrolledByUserId: user.id,
        status: 'ACTIVE'
    };
    pool_1.db.insert('class_students', newEnrollment);
    // Authorize student for default lab of the class
    if (studentUser && classItem.defaultLabCode) {
        if (!studentUser.assignedLabs)
            studentUser.assignedLabs = [];
        if (!studentUser.assignedLabs.includes(classItem.defaultLabCode)) {
            studentUser.assignedLabs.push(classItem.defaultLabCode);
        }
    }
    student.course = classItem.courseCode || student.course;
    student.semester = classItem.semester || student.semester;
    student.section = classItem.section || student.section;
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'STUDENT_ENROLLED_DIRECT',
        entityType: 'CLASS_STUDENT',
        entityId: newEnrollment.id,
        timestamp: new Date().toISOString()
    });
    return res.status(200).json({
        success: true,
        status: 'ENROLLED',
        policy: 'DIRECT',
        data: {
            ...newEnrollment,
            studentName: studentUser?.fullName,
            className: classItem.name,
            defaultLabCode: classItem.defaultLabCode
        },
        message: `Student '${student.studentId}' successfully enrolled in '${classItem.name}'.`
    });
};
exports.enrollStudentInClass = enrollStudentInClass;
/**
 * GET /api/classes/:id/students
 * Retrieve enrolled students for a specific class offering.
 */
const getClassStudents = async (req, res) => {
    const { id } = req.params;
    const classItem = pool_1.db.findOne('classes', (c) => c.id === id);
    if (!classItem) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class not found' });
    }
    const classStudents = pool_1.db.find('class_students', (cs) => cs.classId === id && cs.status === 'ACTIVE');
    const allStudents = pool_1.db.getStore('students');
    const allUsers = pool_1.db.getStore('users');
    const enrolled = classStudents.map((cs) => {
        const s = allStudents.find((st) => st.userId === cs.userId || st.studentId === cs.studentId);
        const u = allUsers.find((usr) => usr.id === cs.userId);
        return {
            id: s?.id || cs.id,
            userId: cs.userId,
            studentId: cs.studentId,
            fullName: u?.fullName || 'Unknown Student',
            email: u?.email || '',
            department: s?.department || 'General',
            course: s?.course || classItem.courseCode,
            yearOfStudy: s?.yearOfStudy || 1,
            semester: s?.semester || classItem.semester,
            section: s?.section || classItem.section,
            enrolledAt: cs.enrolledAt,
            status: 'ACTIVE'
        };
    });
    return res.json({ success: true, data: enrolled, total: enrolled.length });
};
exports.getClassStudents = getClassStudents;
/**
 * DELETE /api/classes/:id/students/:studentId
 * Unenroll student from a class offering.
 */
const unenrollStudentFromClass = async (req, res) => {
    const { id, studentId } = req.params;
    const classItem = pool_1.db.findOne('classes', (c) => c.id === id);
    if (!classItem) {
        return res.status(404).json({ success: false, error: 'CLASS_NOT_FOUND', message: 'Class not found' });
    }
    const classStudents = pool_1.db.getStore('class_students');
    const index = classStudents.findIndex((cs) => cs.classId === id &&
        (cs.studentId?.toUpperCase() === studentId.toUpperCase() ||
            cs.userId === studentId ||
            cs.id === studentId) &&
        cs.status === 'ACTIVE');
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'NOT_ENROLLED', message: 'Student is not enrolled in this class' });
    }
    const removed = classStudents[index];
    classStudents.splice(index, 1);
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: req.user.id,
        actorName: req.user.fullName,
        role: req.user.role,
        action: 'UNENROLL_STUDENT',
        entityType: 'CLASS_STUDENT',
        entityId: removed.id,
        timestamp: new Date().toISOString()
    });
    return res.json({
        success: true,
        message: `Student '${removed.studentId}' unenrolled from '${classItem.name}'`
    });
};
exports.unenrollStudentFromClass = unenrollStudentFromClass;
/**
 * GET /api/enrollment-requests
 * Retrieve enrollment requests pending or reviewed.
 */
const getEnrollmentRequests = async (req, res) => {
    const user = req.user;
    let requests = pool_1.db.getStore('enrollment_requests');
    if (user.role === 'FACULTY') {
        requests = requests.filter((r) => r.requestedByUserId === user.id);
    }
    const { status, classId } = req.query;
    if (status && status !== 'ALL') {
        requests = requests.filter((r) => r.status === status);
    }
    if (classId) {
        requests = requests.filter((r) => r.classId === classId);
    }
    // Sort newest first
    requests = [...requests].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return res.json({ success: true, data: requests });
};
exports.getEnrollmentRequests = getEnrollmentRequests;
/**
 * PATCH /api/enrollment-requests/:id/review
 * Administrator review (approve or reject) of an enrollment request.
 */
const reviewEnrollmentRequest = async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { action, reviewNotes } = req.body;
    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "Action must be 'APPROVE' or 'REJECT'" });
    }
    const request = pool_1.db.findOne('enrollment_requests', (r) => r.id === id);
    if (!request) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Enrollment request not found' });
    }
    const now = new Date().toISOString();
    request.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    request.reviewedByUserId = user.id;
    request.reviewedByUserName = user.fullName;
    request.reviewNotes = reviewNotes || (action === 'APPROVE' ? 'Approved by Administrator' : 'Rejected by Administrator');
    request.updatedAt = now;
    if (action === 'APPROVE') {
        const classStudents = pool_1.db.getStore('class_students');
        const existing = classStudents.find((cs) => cs.classId === request.classId && cs.userId === request.studentUserId);
        if (!existing) {
            pool_1.db.insert('class_students', {
                id: (0, uuid_1.v4)(),
                classId: request.classId,
                studentId: request.studentId,
                userId: request.studentUserId,
                enrolledAt: now,
                enrolledByUserId: request.requestedByUserId,
                status: 'ACTIVE'
            });
        }
        const classItem = pool_1.db.findOne('classes', (c) => c.id === request.classId);
        if (classItem && classItem.defaultLabCode) {
            const studentUser = pool_1.db.findOne('users', (u) => u.id === request.studentUserId);
            if (studentUser) {
                if (!studentUser.assignedLabs)
                    studentUser.assignedLabs = [];
                if (!studentUser.assignedLabs.includes(classItem.defaultLabCode)) {
                    studentUser.assignedLabs.push(classItem.defaultLabCode);
                }
            }
        }
    }
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: `ENROLLMENT_REQUEST_${action}D`,
        entityType: 'ENROLLMENT_REQUEST',
        entityId: request.id,
        timestamp: now
    });
    return res.json({ success: true, data: request, message: `Enrollment request successfully ${action.toLowerCase()}d` });
};
exports.reviewEnrollmentRequest = reviewEnrollmentRequest;
/**
 * GET /api/faculty/dashboard
 * Aggregated live metrics and assigned assets for the authenticated faculty member.
 */
const getFacultyDashboard = async (req, res) => {
    const user = req.user;
    const allClasses = pool_1.db.getStore('classes');
    const allStudents = pool_1.db.getStore('students');
    const allUsers = pool_1.db.getStore('users');
    const allLabs = pool_1.db.getStore('labs');
    const allSessions = pool_1.db.getStore('sessions');
    const allRequests = pool_1.db.getStore('enrollment_requests');
    const classStudents = pool_1.db.getStore('class_students');
    // Faculty classes
    const assignedClasses = allClasses.filter((c) => c.assignedFacultyId === user.id);
    const assignedClassIds = assignedClasses.map((c) => c.id);
    // Enrolled students in faculty classes
    const enrolledStudentIds = new Set();
    classStudents.filter((cs) => assignedClassIds.includes(cs.classId) && cs.status === 'ACTIVE').forEach((cs) => {
        enrolledStudentIds.add(cs.studentId.toUpperCase());
        enrolledStudentIds.add(cs.userId);
    });
    allStudents.forEach((s) => {
        const matchesClass = assignedClasses.some((c) => c.courseCode === s.course && c.section.toUpperCase() === s.section.toUpperCase());
        if (matchesClass) {
            enrolledStudentIds.add(s.studentId.toUpperCase());
            enrolledStudentIds.add(s.userId);
        }
    });
    const facultyStudents = allStudents.filter((s) => enrolledStudentIds.has(s.studentId.toUpperCase()) || enrolledStudentIds.has(s.userId)).map((s) => {
        const u = allUsers.find((usr) => usr.id === s.userId);
        return {
            ...s,
            fullName: u?.fullName || 'Unknown Student',
            email: u?.email || '',
            isActive: u ? u.isActive : true
        };
    });
    const labCodes = new Set();
    if (user.assignedLabs)
        user.assignedLabs.forEach((lc) => labCodes.add(lc.toUpperCase()));
    assignedClasses.forEach((c) => {
        if (c.defaultLabCode)
            labCodes.add(c.defaultLabCode.toUpperCase());
    });
    const facultyLabs = allLabs.filter((l) => labCodes.has(l.code.toUpperCase()));
    const activeSessions = allSessions.filter((s) => s.status === 'ACTIVE' && labCodes.has(s.labCode?.toUpperCase()));
    const pendingRequests = allRequests.filter((r) => r.requestedByUserId === user.id && r.status === 'PENDING');
    return res.json({
        success: true,
        data: {
            faculty: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                department: user.department || 'Computer Science & Engineering',
                role: user.role
            },
            metrics: {
                totalClasses: assignedClasses.length,
                totalStudents: facultyStudents.length,
                assignedLabsCount: facultyLabs.length,
                activeSessionsCount: activeSessions.length,
                pendingRequestsCount: pendingRequests.length
            },
            assignedClasses: assignedClasses.map((cl) => {
                const count = classStudents.filter((cs) => cs.classId === cl.id && cs.status === 'ACTIVE').length;
                return {
                    ...cl,
                    enrolledCount: count || (cl.section === 'A' ? 1 : 0)
                };
            }),
            assignedLabs: facultyLabs,
            activeSessions,
            pendingRequests
        }
    });
};
exports.getFacultyDashboard = getFacultyDashboard;

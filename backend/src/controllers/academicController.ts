import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/pool';
import { ENV } from '../config/env';
import {
  Department,
  Course,
  Subject,
  AcademicYear,
  SectionEntity,
  ClassEntity,
  ClassStudent,
  StudentProfile,
  EnrollmentRequest,
  Lab,
  Computer,
  Session
} from '../../../shared/types';
import bcrypt from 'bcryptjs';
import { getSupabase, isInstitutionBootstrapped, markInstitutionBootstrapped, syncCloudTombstones, recordCloudDeletion } from '../db/supabaseSyncHelper';

let hasBootstrappedAcademic = false;

/**
 * Ensures that a user with role FACULTY has a corresponding row in Supabase 'faculty' table
 * to satisfy the foreign key constraint on academic_classes.faculty_id.
 */
export async function ensureFacultySupabaseId(userId: string): Promise<string | null> {
  if (!userId) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data: existing } = await sb.from('faculty').select('id').eq('user_id', userId).maybeSingle();
    if (existing && existing.id) {
      return existing.id;
    }

    const facultyUser = db.findOne('users', (u: any) => u.id === userId);
    const newFacId = uuidv4();
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
    if (!error) return newFacId;
  } catch (err: any) {
    console.warn('[Academic Supabase] Error ensuring faculty record:', err.message);
  }
  return null;
}

// ============================================================================
// Bootstrap Institutional Academic Foundation
// ============================================================================
export const bootstrapAcademicData = async () => {
  if (hasBootstrappedAcademic) return;
  hasBootstrappedAcademic = true;

  const sb = getSupabase();
  await syncCloudTombstones();

  if (sb) {
    try {
      const { data: supaDepts } = await sb.from('academic_departments').select('*').order('code');
      if (Array.isArray(supaDepts)) {
        const deptsStore = db.getStore('departments');
        const supaDeptIds = new Set(supaDepts.map(d => d.id));
        const supaDeptCodes = new Set(supaDepts.map(d => (d.code || '').toUpperCase()));

        // Bidirectional purge: if deleted from Supabase, remove locally
        for (let i = deptsStore.length - 1; i >= 0; i--) {
          const item = deptsStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.code) || (!supaDeptIds.has(item.id) && !supaDeptCodes.has((item.code || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'DEPARTMENT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
            deptsStore.splice(i, 1);
          }
        }
        for (const d of supaDepts) {
          if (db.isDeleted(d.id) || db.isDeleted(d.code)) continue;
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
        const coursesStore = db.getStore('courses');
        const deptsStore = db.getStore('departments');
        const supaCourseIds = new Set(supaCourses.map(c => c.id));
        const supaCourseCodes = new Set(supaCourses.map(c => (c.code || '').toUpperCase()));

        // Bidirectional purge: if deleted from Supabase, remove locally
        for (let i = coursesStore.length - 1; i >= 0; i--) {
          const item = coursesStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.code) || (!supaCourseIds.has(item.id) && !supaCourseCodes.has((item.code || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'COURSE', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
            coursesStore.splice(i, 1);
          }
        }
        for (const c of supaCourses) {
          if (db.isDeleted(c.id) || db.isDeleted(c.code)) continue;
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
        const subsStore = db.getStore('subjects');
        const deptsStore = db.getStore('departments');
        const supaSubIds = new Set(supaSubs.map(s => s.id));
        const supaSubCodes = new Set(supaSubs.map(s => (s.code || '').toUpperCase()));

        for (let i = subsStore.length - 1; i >= 0; i--) {
          const item = subsStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.code) || (!supaSubIds.has(item.id) && !supaSubCodes.has((item.code || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'SUBJECT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
            subsStore.splice(i, 1);
          }
        }
        for (const s of supaSubs) {
          if (db.isDeleted(s.id) || db.isDeleted(s.code)) continue;
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
        const yearsStore = db.getStore('academic_years');
        const supaYearIds = new Set(supaYears.map(y => y.id));
        const supaYearCodes = new Set(supaYears.map(y => (y.year_code || '').toUpperCase()));

        for (let i = yearsStore.length - 1; i >= 0; i--) {
          const item = yearsStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.year) || (!supaYearIds.has(item.id) && !supaYearCodes.has((item.year || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'ACADEMIC_YEAR', { year: item.year, reason: 'DELETED_FROM_SUPABASE' });
            yearsStore.splice(i, 1);
          }
        }
        for (const y of supaYears) {
          if (db.isDeleted(y.id) || db.isDeleted(y.year_code)) continue;
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
            const secStore = db.getStore('sections');
            secStore.length = 0;
            for (const s of parsedSecs) {
              if (db.isDeleted(s.id) || db.isDeleted(s.name)) continue;
              secStore.push(s);
            }
          }
        } catch {}
      }

      // Hydrate Faculty Mapping for Foreign Key resolution
      const { data: supaFacultyList } = await sb.from('faculty').select('id, user_id');
      const facToUserMap = new Map((supaFacultyList || []).map((f: any) => [f.id, f.user_id]));

      // Hydrate Academic Classes from Supabase
      const { data: supaClasses } = await sb.from('academic_classes').select('*').order('name');
      if (Array.isArray(supaClasses)) {
        const classesStore = db.getStore('classes');
        const labs = db.getStore('labs');
        const users = db.getStore('users');
        const supaClassIds = new Set(supaClasses.map(cl => cl.id));

        for (let i = classesStore.length - 1; i >= 0; i--) {
          const item = classesStore[i];
          if (db.isDeleted(item.id) || !supaClassIds.has(item.id)) {
            db.recordDeletion(item.id, 'CLASS', { name: item.name, reason: 'DELETED_FROM_SUPABASE' });
            classesStore.splice(i, 1);
          }
        }

        for (const cl of supaClasses) {
          if (db.isDeleted(cl.id)) continue;
          const courseObj = db.findOne<Course>('courses', c => c.id === cl.course_id);
          const subjectObj = db.findOne<Subject>('subjects', s => s.id === cl.subject_id);
          const labObj = labs.find((l: any) => l.id === cl.default_lab_id || l.code === cl.default_lab_id);
          const assignedUserId = facToUserMap.get(cl.faculty_id) || cl.faculty_id;
          const assignedUser = assignedUserId ? users.find((u: any) => u.id === assignedUserId) : null;
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
            const classesStore = db.getStore('classes');
            for (const cItem of cachedList) {
              if (db.isDeleted(cItem.id)) continue;
              const existing = classesStore.find((x: any) => x.id === cItem.id);
              if (existing) {
                if (cItem.capacity) existing.capacity = cItem.capacity;
                if (cItem.enrollmentPolicy) existing.enrollmentPolicy = cItem.enrollmentPolicy;
              }
            }
          }
        } catch {}
      }

      // Hydrate Students & Student Users from Supabase
      const { data: supaStudents } = await sb.from('students').select('*').order('created_at');
      if (Array.isArray(supaStudents)) {
        const studentsStore = db.getStore('students');
        const supaStudentIds = new Set(supaStudents.map(s => s.id));
        const supaUserIds = new Set(supaStudents.map(s => s.user_id));

        for (let i = studentsStore.length - 1; i >= 0; i--) {
          const item = studentsStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.userId) || (item.studentId && db.isDeleted(item.studentId)) || (!supaStudentIds.has(item.id) && !supaUserIds.has(item.userId))) {
            db.recordDeletion(item.id, 'STUDENT', { studentId: item.studentId, reason: 'DELETED_FROM_SUPABASE' });
            studentsStore.splice(i, 1);
          }
        }

        for (const st of supaStudents) {
          if (db.isDeleted(st.id) || db.isDeleted(st.user_id) || db.isDeleted(st.student_id)) continue;
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
        const csStore = db.getStore('class_students');
        csStore.length = 0;
        for (const cs of supaClassStudents) {
          if (db.isDeleted(cs.id) || db.isDeleted(cs.student_id) || db.isDeleted(cs.user_id) || db.isDeleted(cs.class_id)) continue;
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
    } catch (err: any) {
      console.warn('[Academic Supabase] Cloud sync note:', err.message);
    }
  }
};

// Auto-run bootstrap once on startup
bootstrapAcademicData();

// ============================================================================
// 1. Departments CRUD
// ============================================================================
export const getDepartments = async (req: AuthenticatedRequest, res: Response) => {
  await bootstrapAcademicData();

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaDepts, error } = await sb.from('academic_departments').select('*').order('code');
      if (!error && Array.isArray(supaDepts)) {
        const store = db.getStore('departments');
        const supaIds = new Set(supaDepts.map((d: any) => d.id));
        const supaCodes = new Set(supaDepts.map((d: any) => (d.code || '').toUpperCase()));

        // Purge if deleted in Supabase
        for (let i = store.length - 1; i >= 0; i--) {
          const item = store[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.code) || (!supaIds.has(item.id) && !supaCodes.has((item.code || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'DEPARTMENT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
            store.splice(i, 1);
          }
        }

        for (const d of supaDepts) {
          if (db.isDeleted(d.id) || db.isDeleted(d.code)) continue;
          const idx = store.findIndex((x: any) => x.id === d.id || x.code.toUpperCase() === d.code.toUpperCase());
          const item = {
            id: d.id,
            code: d.code,
            name: d.name,
            description: d.description || '',
            createdAt: d.created_at || new Date().toISOString()
          };
          if (idx >= 0) {
            store[idx] = { ...store[idx], ...item };
          } else {
            store.push(item);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Academic Supabase] getDepartments error:', e.message);
    }
  }

  const search = (req.query.search as string || '').toLowerCase().trim();
  let depts: Department[] = (db.getStore('departments') as Department[]).filter(d => !db.isDeleted(d.id) && !db.isDeleted(d.code));

  if (search) {
    depts = depts.filter((d) =>
      d.code.toLowerCase().includes(search) || d.name.toLowerCase().includes(search)
    );
  }

  return res.json({ success: true, data: depts });
};

export const createDepartment = async (req: AuthenticatedRequest, res: Response) => {
  const { code, name, description } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Department Code and Name are required' });
  }

  const existing = db.findOne<Department>('departments', (d) => d.code.toUpperCase() === code.trim().toUpperCase());
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Department code '${code}' already exists` });
  }

  const dept: Department = {
    id: uuidv4(),
    code: code.trim().toUpperCase(),
    name: name.trim(),
    description: description ? description.trim() : undefined,
    createdAt: new Date().toISOString()
  };
  db.insert('departments', dept);

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('academic_departments').upsert({
        id: dept.id,
        code: dept.code,
        name: dept.name,
        description: dept.description,
        created_at: dept.createdAt
      });
    } catch (e: any) {
      console.warn('[Academic Supabase] Insert department error:', e.message);
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    role: req.user!.role,
    action: 'CREATE_DEPARTMENT',
    entityType: 'DEPARTMENT',
    entityId: dept.id,
    timestamp: new Date().toISOString()
  });

  return res.status(201).json({ success: true, data: dept });
};

export const updateDepartment = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { code, name, description } = req.body;

  const dept = db.findOne<Department>('departments', (d) => d.id === id);
  if (!dept) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Department not found' });
  }

  if (code && code.trim().toUpperCase() !== dept.code) {
    const existing = db.findOne<Department>('departments', (d) => d.code.toUpperCase() === code.trim().toUpperCase() && d.id !== id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Department code '${code}' already exists` });
    }
    dept.code = code.trim().toUpperCase();
  }

  if (name) dept.name = name.trim();
  if (description !== undefined) dept.description = description.trim();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('academic_departments').update({
        code: dept.code,
        name: dept.name,
        description: dept.description
      }).eq('id', id);
    } catch (e: any) {
      console.warn('[Academic Supabase] Update department error:', e.message);
    }
  }

  return res.json({ success: true, data: dept });
};

export const deleteDepartment = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  hasBootstrappedAcademic = true;

  const dept = db.findOne<Department>('departments', (d) => d.id === id);
  if (!dept) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Department not found' });
  }

  // Cascade delete related courses and subjects from local store
  const courses = db.getStore('courses');
  const subjects = db.getStore('subjects');
  const classes = db.getStore('classes');

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
  const depts = db.getStore('departments');
  const index = depts.findIndex((d) => d.id === id);
  if (index !== -1) {
    depts.splice(index, 1);
  }
  await recordCloudDeletion(id, 'DEPARTMENT', { code: dept.code });
  db.flush();

  // Remove from Supabase Cloud
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('academic_courses').delete().eq('department_id', id);
      await sb.from('academic_departments').delete().eq('id', id);
    } catch (e: any) {
      console.warn('[Academic Supabase] Delete department error:', e.message);
    }
  }

  return res.json({ success: true, message: `Department '${dept.code}' and associated programs deleted successfully` });
};

// ============================================================================
// 2. Courses CRUD
// ============================================================================
export const getCourses = async (req: AuthenticatedRequest, res: Response) => {
  await bootstrapAcademicData();

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaCourses, error } = await sb.from('academic_courses').select('*').order('code');
      if (!error && Array.isArray(supaCourses)) {
        const depts = db.getStore('departments');
        const coursesStore = db.getStore('courses');
        const supaIds = new Set(supaCourses.map((c: any) => c.id));
        const supaCodes = new Set(supaCourses.map((c: any) => (c.code || '').toUpperCase()));

        // Purge if deleted in Supabase
        for (let i = coursesStore.length - 1; i >= 0; i--) {
          const item = coursesStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.code) || (!supaIds.has(item.id) && !supaCodes.has((item.code || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'COURSE', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
            coursesStore.splice(i, 1);
          }
        }

        for (const c of supaCourses) {
          if (db.isDeleted(c.id) || db.isDeleted(c.code)) continue;
          const dept = depts.find((d: any) => d.id === c.department_id || d.code === c.department_id);
          const idx = coursesStore.findIndex((x: any) => x.id === c.id || x.code.toUpperCase() === c.code.toUpperCase());
          const courseItem: Course = {
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
          } else {
            coursesStore.push(courseItem);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Academic Supabase] getCourses error:', e.message);
    }
  }

  const search = (req.query.search as string || '').toLowerCase().trim();
  const departmentId = req.query.departmentId as string;
  let courses: Course[] = (db.getStore('courses') as Course[]).filter(c => !db.isDeleted(c.id) && !db.isDeleted(c.code));
  const depts = db.getStore('departments');

  // Enhance courses with departmentCode if missing
  courses = courses.map((c) => {
    const d = depts.find((dept: any) => dept.id === c.departmentId || dept.code === c.departmentCode);
    return {
      ...c,
      departmentCode: d ? d.code : (c.departmentCode || 'GEN')
    };
  });

  if (departmentId) {
    courses = courses.filter((c) => c.departmentId === departmentId || c.departmentCode === departmentId);
  }

  if (search) {
    courses = courses.filter((c) =>
      c.code.toLowerCase().includes(search) || c.name.toLowerCase().includes(search)
    );
  }

  return res.json({ success: true, data: courses });
};

export const createCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { code, name, departmentId, degreeLevel } = req.body;
  if (!code || !name || !departmentId) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Course Code, Name, and Department are required' });
  }

  const dept = db.findOne<Department>('departments', (d) => d.id === departmentId || d.code.toUpperCase() === departmentId.toUpperCase());
  if (!dept) {
    return res.status(400).json({ success: false, error: 'INVALID_DEPARTMENT', message: 'Specified Department does not exist' });
  }

  const existing = db.findOne<Course>('courses', (c) => c.code.toUpperCase() === code.trim().toUpperCase());
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Course code '${code}' already exists` });
  }

  const course: Course = {
    id: uuidv4(),
    code: code.trim().toUpperCase(),
    name: name.trim(),
    departmentId: dept.id,
    departmentCode: dept.code,
    degreeLevel: degreeLevel || 'Undergraduate',
    createdAt: new Date().toISOString()
  };
  db.insert('courses', course);

  const sb = getSupabase();
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
    } catch (e: any) {
      console.warn('[Academic Supabase] Insert course error:', e.message);
    }
  }

  if (req.user) {
    db.insert('audit_logs', {
      id: uuidv4(),
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

export const updateCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { code, name, departmentId, degreeLevel } = req.body;

  const course = db.findOne<Course>('courses', (c) => c.id === id);
  if (!course) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Course not found' });
  }

  if (code && code.trim().toUpperCase() !== course.code) {
    const existing = db.findOne<Course>('courses', (c) => c.code.toUpperCase() === code.trim().toUpperCase() && c.id !== id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Course code '${code}' already exists` });
    }
    course.code = code.trim().toUpperCase();
  }

  if (departmentId && departmentId !== course.departmentId) {
    const dept = db.findOne<Department>('departments', (d) => d.id === departmentId || d.code.toUpperCase() === departmentId.toUpperCase());
    if (!dept) {
      return res.status(400).json({ success: false, error: 'INVALID_DEPARTMENT', message: 'Department not found' });
    }
    course.departmentId = dept.id;
    course.departmentCode = dept.code;
  }

  if (name) course.name = name.trim();
  if (degreeLevel) course.degreeLevel = degreeLevel;

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('academic_courses').update({
        code: course.code,
        name: course.name,
        department_id: course.departmentId,
        degree_level: course.degreeLevel
      }).eq('id', id);
    } catch (e: any) {
      console.warn('[Academic Supabase] Update course error:', e.message);
    }
  }

  if (req.user) {
    db.insert('audit_logs', {
      id: uuidv4(),
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

export const deleteCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  hasBootstrappedAcademic = true;

  const course = db.findOne<Course>('courses', (c) => c.id === id);
  if (!course) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Course not found' });
  }

  // Cascade clean classes tied to this course
  const classes = db.getStore('classes');
  const remainingClasses = classes.filter((cl) => cl.courseId !== id && cl.courseCode !== course.code);
  classes.length = 0;
  classes.push(...remainingClasses);

  const courses = db.getStore('courses');
  const index = courses.findIndex((c) => c.id === id);
  if (index !== -1) courses.splice(index, 1);
  await recordCloudDeletion(id, 'COURSE', { code: course.code });
  db.flush();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('academic_courses').delete().eq('id', id);
    } catch (e: any) {
      console.warn('[Academic Supabase] Delete course error:', e.message);
    }
  }

  if (req.user) {
    db.insert('audit_logs', {
      id: uuidv4(),
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

// ============================================================================
// 3. Subjects & Curriculum CRUD
// ============================================================================
export const getSubjects = async (req: AuthenticatedRequest, res: Response) => {
  await bootstrapAcademicData();
  const search = (req.query.search as string || '').toLowerCase().trim();
  const departmentId = req.query.departmentId as string;
  const semester = req.query.semester ? parseInt(req.query.semester as string) : undefined;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaSubs, error } = await sb.from('subjects').select('*').order('code');
      if (!error && Array.isArray(supaSubs)) {
        const subsStore = db.getStore('subjects');
        const depts = db.getStore('departments');
        const supaIds = new Set(supaSubs.map((s: any) => s.id));
        const supaCodes = new Set(supaSubs.map((s: any) => (s.code || '').toUpperCase()));

        // Purge if deleted in Supabase
        for (let i = subsStore.length - 1; i >= 0; i--) {
          const item = subsStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.code) || (!supaIds.has(item.id) && !supaCodes.has((item.code || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'SUBJECT', { code: item.code, reason: 'DELETED_FROM_SUPABASE' });
            subsStore.splice(i, 1);
          }
        }

        for (const s of supaSubs) {
          if (db.isDeleted(s.id) || db.isDeleted(s.code)) continue;
          const deptObj = depts.find((d: any) => d.code === s.department || d.id === s.department_id);
          const idx = subsStore.findIndex((x: any) => x.id === s.id || x.code.toUpperCase() === s.code.toUpperCase());
          const item: Subject = {
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
          } else {
            subsStore.push(item);
          }
        }
      }
    } catch (err: any) {
      console.warn('[Subjects Supabase] Fetch error:', err.message);
    }
  }

  let subjects: Subject[] = (db.getStore('subjects') as Subject[]).filter(s => !db.isDeleted(s.id) && !db.isDeleted(s.code));
  const depts = db.getStore('departments');

  subjects = subjects.map((s) => {
    const d = depts.find((dept: any) => dept.id === s.departmentId || dept.code === s.departmentCode);
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
    subjects = subjects.filter((s) =>
      s.code.toLowerCase().includes(search) || s.name.toLowerCase().includes(search)
    );
  }

  return res.json({ success: true, data: subjects });
};

export const createSubject = async (req: AuthenticatedRequest, res: Response) => {
  const { code, name, departmentId, semester, credits } = req.body;
  if (!code || !name || !semester) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Subject Code, Name, and Semester are required' });
  }

  const existing = db.findOne<Subject>('subjects', (s) => s.code.toUpperCase() === code.trim().toUpperCase());
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Subject code '${code}' already exists` });
  }

  let deptCode = 'GEN';
  if (departmentId) {
    const dept = db.findOne<Department>('departments', (d) => d.id === departmentId);
    if (dept) deptCode = dept.code;
  }

  const subject: Subject = {
    id: uuidv4(),
    code: code.trim().toUpperCase(),
    name: name.trim(),
    departmentId,
    departmentCode: deptCode,
    semester: Number(semester),
    credits: credits ? Number(credits) : 2,
    createdAt: new Date().toISOString()
  };
  db.insert('subjects', subject);

  const sb = getSupabase();
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
    } catch (err: any) {
      console.warn('[Subjects Supabase] Create error:', err.message);
    }
  }

  return res.status(201).json({ success: true, data: subject });
};

export const updateSubject = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { code, name, departmentId, semester, credits } = req.body;

  const subject = db.findOne<Subject>('subjects', (s) => s.id === id);
  if (!subject) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Subject not found' });
  }

  if (code && code.trim().toUpperCase() !== subject.code) {
    const existing = db.findOne<Subject>('subjects', (s) => s.code.toUpperCase() === code.trim().toUpperCase() && s.id !== id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: `Subject code '${code}' already exists` });
    }
    subject.code = code.trim().toUpperCase();
  }

  if (departmentId) {
    const dept = db.findOne<Department>('departments', (d) => d.id === departmentId);
    subject.departmentId = departmentId;
    if (dept) subject.departmentCode = dept.code;
  }

  if (name) subject.name = name.trim();
  if (semester) subject.semester = Number(semester);
  if (credits !== undefined) subject.credits = Number(credits);

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('subjects').update({
        code: subject.code,
        name: subject.name,
        department: subject.departmentCode,
        semester: subject.semester
      }).eq('id', id);
    } catch (err: any) {
      console.warn('[Subjects Supabase] Update error:', err.message);
    }
  }

  return res.json({ success: true, data: subject });
};

export const deleteSubject = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const subject = db.findOne<Subject>('subjects', (s) => s.id === id);
  if (!subject) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Subject not found' });
  }

  // Dependency Check: Block deletion if referenced by classes
  const relatedClasses = db.find<ClassEntity>('classes', (cl) => cl.subjectId === id || cl.subjectCode === subject.code);
  if (relatedClasses.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'CANNOT_DELETE_HAS_DEPENDENCIES',
      message: `Cannot delete subject '${subject.code}' because it is referenced by ${relatedClasses.length} active class offering(s).`
    });
  }

  const subjects = db.getStore('subjects');
  const index = subjects.findIndex((s) => s.id === id);
  if (index !== -1) subjects.splice(index, 1);
  await recordCloudDeletion(id, 'SUBJECT', { code: subject.code });
  db.flush();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('subjects').delete().eq('id', id);
    } catch (err: any) {
      console.warn('[Subjects Supabase] Delete error:', err.message);
    }
  }

  return res.json({ success: true, message: `Subject '${subject.code}' deleted successfully` });
};

// ============================================================================
// 4. Academic Years CRUD
// ============================================================================
export const getAcademicYears = async (_req: AuthenticatedRequest, res: Response) => {
  await bootstrapAcademicData();
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaYears, error } = await sb.from('academic_years').select('*').order('year_code');
      if (!error && Array.isArray(supaYears)) {
        const yearsStore = db.getStore('academic_years');
        const supaIds = new Set(supaYears.map((y: any) => y.id));
        const supaCodes = new Set(supaYears.map((y: any) => (y.year_code || '').toUpperCase()));

        // Purge if deleted in Supabase
        for (let i = yearsStore.length - 1; i >= 0; i--) {
          const item = yearsStore[i];
          if (db.isDeleted(item.id) || db.isDeleted(item.year) || (!supaIds.has(item.id) && !supaCodes.has((item.year || '').toUpperCase()))) {
            db.recordDeletion(item.id, 'ACADEMIC_YEAR', { year: item.year, reason: 'DELETED_FROM_SUPABASE' });
            yearsStore.splice(i, 1);
          }
        }

        for (const y of supaYears) {
          if (db.isDeleted(y.id) || db.isDeleted(y.year_code)) continue;
          const idx = yearsStore.findIndex((x: any) => x.id === y.id || x.year.toUpperCase() === y.year_code.toUpperCase());
          const item: AcademicYear = {
            id: y.id,
            year: y.year_code,
            isCurrent: Boolean(y.is_current),
            startDate: y.start_date,
            endDate: y.end_date,
            createdAt: y.created_at || new Date().toISOString()
          };
          if (idx >= 0) {
            yearsStore[idx] = { ...yearsStore[idx], ...item };
          } else {
            yearsStore.push(item);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Academic Supabase] Fetch years error:', e.message);
    }
  }
  const years: AcademicYear[] = (db.getStore('academic_years') as AcademicYear[]).filter(y => !db.isDeleted(y.id) && !db.isDeleted(y.year));
  return res.json({ success: true, data: years });
};

export const createAcademicYear = async (req: AuthenticatedRequest, res: Response) => {
  const { year, isCurrent, startDate, endDate } = req.body;
  if (!year) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Academic Year string (e.g. 2026-2027) is required' });
  }

  const existing = db.findOne<AcademicYear>('academic_years', (y) => y.year.trim() === year.trim());
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_YEAR', message: `Academic Year '${year}' already exists` });
  }

  // Multi-active sessions: do NOT uncheck other sessions; allow multiple active sessions concurrently!
  const newYear: AcademicYear = {
    id: uuidv4(),
    year: year.trim(),
    isCurrent: Boolean(isCurrent),
    startDate: startDate || '2025-08-01',
    endDate: endDate || '2026-05-31',
    createdAt: new Date().toISOString()
  };
  db.insert('academic_years', newYear);

  const sb = getSupabase();
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
    } catch (e: any) {
      console.warn('[Academic Supabase] Insert year error:', e.message);
    }
  }

  return res.status(201).json({ success: true, data: newYear });
};

export const updateAcademicYear = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { year, isCurrent, startDate, endDate } = req.body;

  const y = db.findOne<AcademicYear>('academic_years', (item) => item.id === id);
  if (!y) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Academic Year not found' });
  }

  if (year && year.trim() !== y.year) {
    const existing = db.findOne<AcademicYear>('academic_years', (item) => item.year === year.trim() && item.id !== id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'DUPLICATE_YEAR', message: `Academic Year '${year}' already exists` });
    }
    y.year = year.trim();
  }

  // Multi-active sessions: allow toggling isCurrent without clearing other sessions!
  if (isCurrent !== undefined) {
    y.isCurrent = Boolean(isCurrent);
  }

  if (startDate !== undefined) y.startDate = startDate;
  if (endDate !== undefined) y.endDate = endDate;

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('academic_years').update({
        year_code: y.year,
        is_current: y.isCurrent,
        start_date: y.startDate,
        end_date: y.endDate
      }).eq('id', id);
    } catch (e: any) {
      console.warn('[Academic Supabase] Update year error:', e.message);
    }
  }

  return res.json({ success: true, data: y });
};

export const deleteAcademicYear = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const y = db.findOne<AcademicYear>('academic_years', (item) => item.id === id);
  if (!y) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Academic Year not found' });
  }

  // Dependency Check
  const relatedClasses = db.find<ClassEntity>('classes', (cl) => cl.academicYear === y.year);
  if (relatedClasses.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'CANNOT_DELETE_HAS_DEPENDENCIES',
      message: `Cannot delete Academic Year '${y.year}' because it is referenced by ${relatedClasses.length} class offering(s).`
    });
  }

  const years = db.getStore('academic_years');
  const index = years.findIndex((item) => item.id === id);
  if (index !== -1) years.splice(index, 1);
  await recordCloudDeletion(id, 'ACADEMIC_YEAR', { year: y.year });
  db.flush();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('academic_years').delete().eq('id', id);
    } catch (e: any) {
      console.warn('[Academic Supabase] Delete year error:', e.message);
    }
  }

  return res.json({ success: true, message: `Academic Year '${y.year}' deleted successfully` });
};

// ============================================================================
// 5. Sections CRUD
// ============================================================================
export const getSections = async (_req: AuthenticatedRequest, res: Response) => {
  await bootstrapAcademicData();
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: secSetting } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_sections').maybeSingle();
      if (secSetting && secSetting.setting_value) {
        const parsed = JSON.parse(secSetting.setting_value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const secStore = db.getStore('sections');
          secStore.length = 0;
          secStore.push(...parsed);
        }
      }
    } catch {}
  }
  const sections: SectionEntity[] = db.getStore('sections');
  return res.json({ success: true, data: sections });
};

export const createSection = async (req: AuthenticatedRequest, res: Response) => {
  const { name, courseId, semester } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Section name (e.g. A, B, C) is required' });
  }

  const cleanName = name.trim().toUpperCase();
  const existing = db.findOne<SectionEntity>('sections', (s) => s.name.toUpperCase() === cleanName);
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_SECTION', message: `Section '${cleanName}' already exists` });
  }

  const section: SectionEntity = {
    id: uuidv4(),
    name: cleanName,
    courseId,
    semester: semester ? Number(semester) : undefined,
    createdAt: new Date().toISOString()
  };
  db.insert('sections', section);

  const sb = getSupabase();
  if (sb) {
    try {
      const secStore = db.getStore('sections');
      await sb.from('system_settings').upsert({
        setting_key: 'academic_sections',
        setting_value: JSON.stringify(secStore),
        description: 'Persistent list of institutional sections',
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (e: any) {
      console.warn('[Academic Supabase] Save sections error:', e.message);
    }
  }

  return res.status(201).json({ success: true, data: section });
};

export const deleteSection = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const section = db.findOne<SectionEntity>('sections', (s) => s.id === id);
  if (!section) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Section not found' });
  }

  // Dependency Check
  const relatedClasses = db.find<ClassEntity>('classes', (cl) => cl.section === section.name);
  if (relatedClasses.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'CANNOT_DELETE_HAS_DEPENDENCIES',
      message: `Cannot delete section '${section.name}' because it is referenced by ${relatedClasses.length} class offering(s).`
    });
  }

  const sections = db.getStore('sections');
  const index = sections.findIndex((s) => s.id === id);
  if (index !== -1) sections.splice(index, 1);
  await recordCloudDeletion(id, 'SECTION', { name: section.name });
  db.flush();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('system_settings').upsert({
        setting_key: 'academic_sections',
        setting_value: JSON.stringify(sections.filter(s => !db.isDeleted(s.id) && !db.isDeleted(s.name))),
        description: 'Persistent list of institutional sections',
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (e: any) {
      console.warn('[Academic Supabase] Delete section error:', e.message);
    }
  }

  return res.json({ success: true, message: `Section '${section.name}' deleted successfully` });
};

// ============================================================================
// 6. Academic Classes CRUD
// ============================================================================
export const getClasses = async (req: AuthenticatedRequest, res: Response) => {
  await bootstrapAcademicData();

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaClasses, error } = await sb.from('academic_classes').select('*').order('name');
      if (!error && Array.isArray(supaClasses)) {
        const classesStore = db.getStore('classes');
        const supaClassIds = new Set(supaClasses.map((cl: any) => cl.id));

        for (let i = classesStore.length - 1; i >= 0; i--) {
          const item = classesStore[i];
          if (db.isDeleted(item.id) || !supaClassIds.has(item.id)) {
            db.recordDeletion(item.id, 'CLASS', { name: item.name, reason: 'DELETED_FROM_SUPABASE' });
            classesStore.splice(i, 1);
          }
        }
      }
    } catch {}
  }

  const user = req.user!;
  let classes: ClassEntity[] = (db.getStore('classes') as ClassEntity[]).filter(c => !db.isDeleted(c.id));
  const courses = db.getStore('courses');
  const subjects = db.getStore('subjects');
  const users = db.getStore('users');
  const labs = db.getStore('labs');

  // Enhance classes with human-readable joins
  classes = classes.map((cl) => {
    const course = courses.find((c: any) => c.id === cl.courseId || c.code === cl.courseCode);
    const subject = subjects.find((s: any) => s.id === cl.subjectId || s.code === cl.subjectCode);
    const faculty = users.find((u: any) => u.id === cl.assignedFacultyId);
    const lab = labs.find((l: any) => l.id === cl.defaultLabId || l.code === cl.defaultLabCode);

    const classStudents = db.getStore('class_students');
    const enrolled = classStudents.filter((cs: any) => cs.classId === cl.id && cs.status === 'ACTIVE').length;

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

  const search = (req.query.search as string || '').toLowerCase().trim();
  if (search) {
    classes = classes.filter((cl) =>
      (cl.name && cl.name.toLowerCase().includes(search)) ||
      (cl.courseCode && cl.courseCode.toLowerCase().includes(search)) ||
      (cl.subjectCode && cl.subjectCode.toLowerCase().includes(search)) ||
      (cl.assignedFacultyName && cl.assignedFacultyName.toLowerCase().includes(search))
    );
  }

  return res.json({ success: true, data: classes });
};

export const createClass = async (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    courseId,
    subjectId,
    academicYear,
    semester,
    section,
    defaultLabId,
    defaultLabCode,
    assignedFacultyId,
    enrollmentPolicy,
    capacity
  } = req.body;

  if (!courseId || !subjectId || !academicYear || !semester || !section) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Course, Subject, Academic Year, Semester, and Section are required'
    });
  }

  const course = db.findOne<Course>('courses', (c) => c.id === courseId || c.code === courseId);
  if (!course) {
    return res.status(400).json({ success: false, error: 'INVALID_COURSE', message: 'Course not found' });
  }

  const subject = db.findOne<Subject>('subjects', (s) => s.id === subjectId || s.code === subjectId);
  if (!subject) {
    return res.status(400).json({ success: false, error: 'INVALID_SUBJECT', message: 'Subject not found' });
  }

  // Prevent duplicate offering for same course, subject, year, semester, section
  const existing = db.findOne<ClassEntity>('classes', (cl) =>
    (cl.courseId === course.id || cl.courseCode === course.code) &&
    (cl.subjectId === subject.id || cl.subjectCode === subject.code) &&
    cl.academicYear === academicYear &&
    cl.semester === Number(semester) &&
    cl.section === section.trim().toUpperCase()
  );

  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_CLASS_OFFERING',
      message: `A class offering already exists for ${course.code} - ${subject.code} (${academicYear} Sem ${semester} Sec ${section})`
    });
  }

  let facultyName = '';
  if (assignedFacultyId) {
    const facultyUser = db.findOne('users', (u: any) => u.id === assignedFacultyId);
    if (facultyUser) facultyName = facultyUser.fullName;
  }

  let finalLabCode = defaultLabCode;
  if (defaultLabId && !finalLabCode) {
    const lab = db.findOne('labs', (l: any) => l.id === defaultLabId);
    if (lab) finalLabCode = lab.code;
  }

  const className = name && name.trim() ? name.trim() : `${subject.name} (Sec ${section.toUpperCase()})`;

  const newClass: ClassEntity = {
    id: uuidv4(),
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

  db.insert('classes', newClass);

  const sb = getSupabase();
  if (sb) {
    try {
      let supaFacultyId: string | null = null;
      if (assignedFacultyId) {
        supaFacultyId = await ensureFacultySupabaseId(assignedFacultyId);
      }

      let supaLabId = defaultLabId || null;
      if (finalLabCode && !supaLabId) {
        const labObj = db.findOne('labs', (l: any) => l.code === finalLabCode);
        if (labObj) supaLabId = labObj.id;
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

      const allClasses = db.getStore('classes');
      await sb.from('system_settings').upsert({
        setting_key: 'academic_classes_cache',
        setting_value: JSON.stringify(allClasses),
        description: 'Cache of academic classes offerings with full metadata',
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (err: any) {
      console.warn('[Classes Supabase] Create class error:', err.message);
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    role: req.user!.role,
    action: 'CREATE_CLASS_OFFERING',
    entityType: 'CLASS',
    entityId: newClass.id,
    timestamp: new Date().toISOString()
  });

  return res.status(201).json({ success: true, data: newClass });
};

export const updateClass = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    name,
    courseId,
    subjectId,
    academicYear,
    semester,
    section,
    defaultLabCode,
    assignedFacultyId,
    status,
    enrollmentPolicy,
    capacity
  } = req.body;

  const cl = db.findOne<ClassEntity>('classes', (item) => item.id === id);
  if (!cl) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class offering not found' });
  }

  if (courseId) {
    const course = db.findOne<Course>('courses', (c) => c.id === courseId || c.code === courseId);
    if (course) {
      cl.courseId = course.id;
      cl.courseCode = course.code;
    }
  }

  if (subjectId) {
    const subject = db.findOne<Subject>('subjects', (s) => s.id === subjectId || s.code === subjectId);
    if (subject) {
      cl.subjectId = subject.id;
      cl.subjectCode = subject.code;
      cl.subjectName = subject.name;
    }
  }

  if (name) cl.name = name.trim();
  if (academicYear) cl.academicYear = academicYear.trim();
  if (semester) cl.semester = Number(semester);
  if (section) cl.section = section.trim().toUpperCase();
  if (defaultLabCode !== undefined) cl.defaultLabCode = defaultLabCode;
  if (status) cl.status = status;
  if (enrollmentPolicy !== undefined) cl.enrollmentPolicy = enrollmentPolicy;
  if (capacity !== undefined) cl.capacity = Number(capacity);

  if (assignedFacultyId !== undefined) {
    cl.assignedFacultyId = assignedFacultyId;
    if (assignedFacultyId) {
      const facultyUser = db.findOne('users', (u: any) => u.id === assignedFacultyId);
      cl.assignedFacultyName = facultyUser ? facultyUser.fullName : undefined;
    } else {
      cl.assignedFacultyName = undefined;
    }
  }

  const sb = getSupabase();
  if (sb) {
    try {
      let supaFacultyId: string | null = null;
      if (cl.assignedFacultyId) {
        supaFacultyId = await ensureFacultySupabaseId(cl.assignedFacultyId);
      }
      let supaLabId = cl.defaultLabId || null;
      if (cl.defaultLabCode && !supaLabId) {
        const labObj = db.findOne('labs', (l: any) => l.code === cl.defaultLabCode);
        if (labObj) supaLabId = labObj.id;
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

      const allClasses = db.getStore('classes');
      await sb.from('system_settings').upsert({
        setting_key: 'academic_classes_cache',
        setting_value: JSON.stringify(allClasses),
        description: 'Cache of academic classes offerings with full metadata',
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (err: any) {
      console.warn('[Classes Supabase] Update class error:', err.message);
    }
  }

  return res.json({ success: true, data: cl });
};

export const deleteClass = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  hasBootstrappedAcademic = true;
  const cl = db.findOne<ClassEntity>('classes', (item) => item.id === id);
  if (!cl) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class offering not found' });
  }

  db.delete('classes', (item: any) => item.id === id);
  await recordCloudDeletion(id, 'CLASS', { name: cl.name });
  db.flush();

  // Cascade delete in-memory class student assignments
  db.delete('class_students', (cs: any) => cs.classId === id);

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('student_class_assignments').delete().eq('class_id', id);
      await sb.from('academic_classes').delete().eq('id', id);
      const allClasses = db.getStore('classes').filter((c: any) => !db.isDeleted(c.id));
      await sb.from('system_settings').upsert({
        setting_key: 'academic_classes_cache',
        setting_value: JSON.stringify(allClasses),
        description: 'Cache of academic classes offerings with full metadata',
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (e: any) {
      console.warn('[Classes Supabase] Delete error:', e.message);
    }
  }

  return res.json({ success: true, message: `Class offering '${cl.name}' deleted successfully` });
};

// ============================================================================
// 7. Student Profiles & Enrollment
// ============================================================================
export const getStudents = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const students = db.getStore('students') as StudentProfile[];
  const users = db.getStore('users');
  const classStudents = db.getStore('class_students') as ClassStudent[];
  const classes = db.getStore('classes') as ClassEntity[];

  // Join students with user details
  let joined = students.map((s: StudentProfile) => {
    const u = users.find((usr: any) => usr.id === s.userId);
    return {
      ...s,
      fullName: u ? u.fullName : 'Unknown',
      email: u ? u.email : '',
      isActive: u ? u.isActive : true,
      assignedLabs: u?.assignedLabs || []
    };
  });

  const { classId, search, course, section } = req.query as any;

  if (classId) {
    const enrolledInClass = new Set(
      classStudents.filter((cs: any) => cs.classId === classId && cs.status === 'ACTIVE').map((cs: any) => cs.userId)
    );
    const targetClass = classes.find((c) => c.id === classId);
    joined = joined.filter(
      (s) => enrolledInClass.has(s.userId) || (targetClass && s.course === targetClass.courseCode && s.section === targetClass.section)
    );
  }

  if (course) {
    joined = joined.filter((s) => s.course?.toUpperCase() === course.toUpperCase());
  }

  if (section) {
    joined = joined.filter((s) => s.section?.toUpperCase() === section.toUpperCase());
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    joined = joined.filter(
      (s) =>
        s.studentId?.toLowerCase().includes(q) ||
        (s as any).identifier?.toLowerCase().includes(q) ||
        s.fullName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q) ||
        s.course?.toLowerCase().includes(q) ||
        s.section?.toLowerCase().includes(q) ||
        ((s as any).phone && (s as any).phone.toLowerCase().includes(q))
    );
  }

  // Student can only see self
  if (user.role === 'STUDENT') {
    const self = joined.filter((s: any) => s.userId === user.id);
    return res.json({ success: true, data: self });
  }

  return res.json({ success: true, data: joined });
};

export const enrollStudent = async (req: AuthenticatedRequest, res: Response) => {
  const {
    studentId,
    fullName,
    dateOfBirth,
    gender,
    email,
    phone,
    department,
    course,
    yearOfStudy,
    semester,
    section,
    academicYear,
    authorizedLabs,
    password,
    classId
  } = req.body;

  if (!studentId || !fullName || !email) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Required student fields missing' });
  }

  // Prevent duplicate enrollment
  const existingUser = db.findOne('users', (u: any) => u.email.toLowerCase() === email.toLowerCase());
  const existingStudent = db.findOne('students', (s: any) => s.studentId.toLowerCase() === studentId.toLowerCase());

  if (existingUser || existingStudent) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_STUDENT', message: 'Student ID or Email already registered' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password || 'Student@123', salt);
  const userId = uuidv4();

  const finalLabs = authorizedLabs || [];
  if (classId) {
    const targetClass = db.findOne<ClassEntity>('classes', (c) => c.id === classId);
    if (targetClass?.defaultLabCode && !finalLabs.includes(targetClass.defaultLabCode)) {
      finalLabs.push(targetClass.defaultLabCode);
    }
  }

  db.insert('users', {
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

  const studentProfile: StudentProfile = {
    id: uuidv4(),
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

  db.insert('students', studentProfile);

  // If classId specified, directly link to class
  if (classId) {
    db.insert('class_students', {
      id: uuidv4(),
      classId,
      studentId,
      userId,
      enrolledAt: new Date().toISOString(),
      enrolledByUserId: req.user!.id,
      status: 'ACTIVE'
    });
  }

  // Two-way Supabase Cloud Synchronization: Persist user & student immediately
  const sb = getSupabase();
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
          id: uuidv4(),
          class_id: classId,
          student_id: studentProfile.id,
          user_id: userId,
          enrolled_at: new Date().toISOString(),
          enrolled_by_user_id: req.user!.id,
          status: 'ACTIVE'
        }, { onConflict: 'id' });
      }
    } catch (err: any) {
      console.warn('[EnrollStudent Supabase] Direct sync error:', err.message);
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    role: req.user!.role,
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

/**
 * POST /api/classes/:id/enroll
 * Enroll existing student into a class with policy evaluation (DIRECT vs APPROVAL_REQUIRED).
 */
export const enrollStudentInClass = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { studentIdentifier, studentId, notes } = req.body;
  const targetId = studentIdentifier || studentId;

  if (!targetId) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Student identifier or ID is required' });
  }

  const classItem = db.findOne<ClassEntity>('classes', (c) => c.id === id);
  if (!classItem) {
    return res.status(404).json({ success: false, error: 'CLASS_NOT_FOUND', message: 'Class offering not found' });
  }

  const student = db.findOne<StudentProfile>('students', (s) =>
    s.id === targetId ||
    s.userId === targetId ||
    s.studentId.toUpperCase() === String(targetId).toUpperCase()
  );
  if (!student) {
    return res.status(404).json({ success: false, error: 'STUDENT_NOT_FOUND', message: 'Student profile not found' });
  }

  const studentUser = db.findOne('users', (u: any) => u.id === student.userId);

  // Check if already enrolled in this class
  const classStudents = db.getStore('class_students');
  const alreadyEnrolled = classStudents.find(
    (cs: any) => cs.classId === classItem.id && (cs.userId === student.userId || cs.studentId.toUpperCase() === student.studentId.toUpperCase()) && cs.status === 'ACTIVE'
  );
  if (alreadyEnrolled) {
    return res.status(409).json({ success: false, error: 'ALREADY_ENROLLED', message: `Student '${student.studentId}' is already enrolled in '${classItem.name}'` });
  }

  const policy = classItem.enrollmentPolicy || 'DIRECT';

  if (policy === 'APPROVAL_REQUIRED' && user.role !== 'ADMIN') {
    const existingReq = db.findOne('enrollment_requests', (er: any) =>
      er.classId === classItem.id && er.studentUserId === student.userId && er.status === 'PENDING'
    );
    if (existingReq) {
      return res.status(409).json({
        success: false,
        error: 'PENDING_REQUEST_EXISTS',
        message: 'A pending enrollment request already exists for this student and class offering'
      });
    }

    const newRequest: EnrollmentRequest = {
      id: uuidv4(),
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

    db.insert('enrollment_requests', newRequest);

    db.insert('audit_logs', {
      id: uuidv4(),
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
    id: uuidv4(),
    classId: classItem.id,
    studentId: student.studentId,
    userId: student.userId,
    enrolledAt: new Date().toISOString(),
    enrolledByUserId: user.id,
    status: 'ACTIVE'
  };
  db.insert('class_students', newEnrollment);

  // Authorize student for default lab of the class
  if (studentUser && classItem.defaultLabCode) {
    if (!studentUser.assignedLabs) studentUser.assignedLabs = [];
    if (!studentUser.assignedLabs.includes(classItem.defaultLabCode)) {
      studentUser.assignedLabs.push(classItem.defaultLabCode);
    }
  }

  student.course = classItem.courseCode || student.course;
  student.semester = classItem.semester || student.semester;
  student.section = classItem.section || student.section;

  db.insert('audit_logs', {
    id: uuidv4(),
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

/**
 * GET /api/classes/:id/students
 * Retrieve enrolled students for a specific class offering.
 */
export const getClassStudents = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const classItem = db.findOne<ClassEntity>('classes', (c) => c.id === id);
  if (!classItem) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class not found' });
  }

  const classStudents = db.find('class_students', (cs: any) => cs.classId === id && cs.status === 'ACTIVE');
  const allStudents = db.getStore('students');
  const allUsers = db.getStore('users');

  const enrolled = classStudents.map((cs: any) => {
    const s = allStudents.find((st: any) => st.userId === cs.userId || st.studentId === cs.studentId);
    const u = allUsers.find((usr: any) => usr.id === cs.userId);
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

/**
 * DELETE /api/classes/:id/students/:studentId
 * Unenroll student from a class offering.
 */
export const unenrollStudentFromClass = async (req: AuthenticatedRequest, res: Response) => {
  const { id, studentId } = req.params;
  const classItem = db.findOne<ClassEntity>('classes', (c) => c.id === id);
  if (!classItem) {
    return res.status(404).json({ success: false, error: 'CLASS_NOT_FOUND', message: 'Class not found' });
  }

  const classStudents = db.getStore('class_students');
  const index = classStudents.findIndex(
    (cs: any) =>
      cs.classId === id &&
      (cs.studentId?.toUpperCase() === studentId.toUpperCase() ||
        cs.userId === studentId ||
        cs.id === studentId) &&
      cs.status === 'ACTIVE'
  );

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'NOT_ENROLLED', message: 'Student is not enrolled in this class' });
  }

  const removed = classStudents[index];
  classStudents.splice(index, 1);

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    role: req.user!.role,
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

/**
 * GET /api/enrollment-requests
 * Retrieve enrollment requests pending or reviewed.
 */
export const getEnrollmentRequests = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let requests = db.getStore('enrollment_requests');

  if (user.role === 'FACULTY') {
    requests = requests.filter((r: any) => r.requestedByUserId === user.id);
  }

  const { status, classId } = req.query as any;
  if (status && status !== 'ALL') {
    requests = requests.filter((r: any) => r.status === status);
  }
  if (classId) {
    requests = requests.filter((r: any) => r.classId === classId);
  }

  // Sort newest first
  requests = [...requests].sort(
    (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return res.json({ success: true, data: requests });
};

/**
 * PATCH /api/enrollment-requests/:id/review
 * Administrator review (approve or reject) of an enrollment request.
 */
export const reviewEnrollmentRequest = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { action, reviewNotes } = req.body;

  if (!action || !['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "Action must be 'APPROVE' or 'REJECT'" });
  }

  const request = db.findOne('enrollment_requests', (r: any) => r.id === id);
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
    const classStudents = db.getStore('class_students');
    const existing = classStudents.find((cs: any) => cs.classId === request.classId && cs.userId === request.studentUserId);
    if (!existing) {
      db.insert('class_students', {
        id: uuidv4(),
        classId: request.classId,
        studentId: request.studentId,
        userId: request.studentUserId,
        enrolledAt: now,
        enrolledByUserId: request.requestedByUserId,
        status: 'ACTIVE'
      });
    }

    const classItem = db.findOne<ClassEntity>('classes', (c) => c.id === request.classId);
    if (classItem && classItem.defaultLabCode) {
      const studentUser = db.findOne('users', (u: any) => u.id === request.studentUserId);
      if (studentUser) {
        if (!studentUser.assignedLabs) studentUser.assignedLabs = [];
        if (!studentUser.assignedLabs.includes(classItem.defaultLabCode)) {
          studentUser.assignedLabs.push(classItem.defaultLabCode);
        }
      }
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
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

/**
 * GET /api/faculty/dashboard
 * Aggregated live metrics and assigned assets for the authenticated faculty member.
 */
export const getFacultyDashboard = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const allClasses = db.getStore('classes') as ClassEntity[];
  const allStudents = db.getStore('students') as StudentProfile[];
  const allUsers = db.getStore('users');
  const allLabs = db.getStore('labs') as any[];
  const allSessions = db.getStore('sessions') as any[];
  const allRequests = db.getStore('enrollment_requests') as any[];
  const classStudents = db.getStore('class_students') as any[];

  // Faculty classes
  const assignedClasses = allClasses.filter((c) => c.assignedFacultyId === user.id);
  const assignedClassIds = assignedClasses.map((c) => c.id);

  // Enrolled students in faculty classes
  const enrolledStudentIds = new Set<string>();
  classStudents.filter((cs: any) => assignedClassIds.includes(cs.classId) && cs.status === 'ACTIVE').forEach((cs: any) => {
    enrolledStudentIds.add(cs.studentId.toUpperCase());
    enrolledStudentIds.add(cs.userId);
  });

  allStudents.forEach((s) => {
    const matchesClass = assignedClasses.some(
      (c) => c.courseCode === s.course && c.section.toUpperCase() === s.section.toUpperCase()
    );
    if (matchesClass) {
      enrolledStudentIds.add(s.studentId.toUpperCase());
      enrolledStudentIds.add(s.userId);
    }
  });

  const facultyStudents = allStudents.filter(
    (s) => enrolledStudentIds.has(s.studentId.toUpperCase()) || enrolledStudentIds.has(s.userId)
  ).map((s) => {
    const u = allUsers.find((usr: any) => usr.id === s.userId);
    return {
      ...s,
      fullName: u?.fullName || 'Unknown Student',
      email: u?.email || '',
      isActive: u ? u.isActive : true
    };
  });

  const labCodes = new Set<string>();
  if (user.assignedLabs) user.assignedLabs.forEach((lc: string) => labCodes.add(lc.toUpperCase()));
  assignedClasses.forEach((c) => {
    if (c.defaultLabCode) labCodes.add(c.defaultLabCode.toUpperCase());
  });

  const facultyLabs = allLabs.filter((l) => labCodes.has(l.code.toUpperCase()));

  const activeSessions = allSessions.filter(
    (s) => s.status === 'ACTIVE' && labCodes.has(s.labCode?.toUpperCase())
  );

  const pendingRequests = allRequests.filter(
    (r) => r.requestedByUserId === user.id && r.status === 'PENDING'
  );

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
        const count = classStudents.filter((cs: any) => cs.classId === cl.id && cs.status === 'ACTIVE').length;
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

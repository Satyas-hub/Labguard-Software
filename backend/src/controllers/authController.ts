// ============================================================================
// LABGUARD V2: Authentication & User Controller
// ============================================================================

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config/env';
import { db } from '../db/pool';
import { User, UserRole, AuthResponse } from '../../../shared/types';
import { AuthenticatedRequest } from '../middleware/auth';
import { recordFailedLogin, clearFailedLogin } from '../middleware/rateLimit';
import { getSupabase, isInstitutionBootstrapped, syncCloudTombstones, recordCloudDeletion } from '../db/supabaseSyncHelper';
import { RealtimeService } from '../services/realtimeService';

// Sync extended user metadata cache to Supabase system_settings
export const syncExtendedUserCacheToSupabase = async () => {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const users = db.getStore('users');
    const students = db.getStore('students');
    const cachePayload = {
      users: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        identifier: u.identifier,
        department: u.department,
        phone: u.phone,
        assignedLabs: u.assignedLabs || [],
        assignedClasses: u.assignedClasses || [],
        isActive: u.isActive !== false,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      })),
      students: students.map((s: any) => ({
        id: s.id,
        userId: s.userId,
        studentId: s.studentId,
        department: s.department,
        course: s.course,
        yearOfStudy: s.yearOfStudy,
        semester: s.semester,
        section: s.section,
        academicYear: s.academicYear,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        createdAt: s.createdAt
      }))
    };

    await sb.from('system_settings').upsert({
      setting_key: 'users_extended_cache',
      setting_value: JSON.stringify(cachePayload),
      description: 'Extended user metadata, departments, assignedLabs, and student profiles',
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });
  } catch (err: any) {
    console.warn('[Users Extended Cache] Error syncing to Supabase:', err.message);
  }
};

// Ensure bootstrap institutional accounts exist for all 4 roles and persist to Supabase
let hasEnsuredInstitutionalUsers = false;
const ensureBootstrapInstitutionalUsers = async () => {
  if (hasEnsuredInstitutionalUsers) return;
  hasEnsuredInstitutionalUsers = true;

  const salt = bcrypt.genSaltSync(10);
  const sb = getSupabase();
  const alreadyBootstrapped = await isInstitutionBootstrapped();

  const roleIdMap: Record<string, string> = {
    ADMIN: '10000000-0000-0000-0000-000000000001',
    FACULTY: '10000000-0000-0000-0000-000000000002',
    LAB_ASSISTANT: '10000000-0000-0000-0000-000000000003',
    STUDENT: '10000000-0000-0000-0000-000000000004'
  };

  // Zero Demo Accounts Policy: Strictly ensure only the primary Institutional Administrator exists as the anchor
  const adminUser = db.findOne<any>('users', (u) => u.role === 'ADMIN');
  if (!adminUser) {
    const passwordHash = bcrypt.hashSync('Admin@123456', salt);
    db.insert('users', {
      id: '20000000-0000-0000-0000-000000000001',
      email: 'admin@labguard.edu',
      passwordHash,
      fullName: 'Institutional System Administrator',
      role: 'ADMIN' as UserRole,
      phone: '+1 800-LABGUARD',
      identifier: 'admin@labguard.edu',
      department: 'Administration',
      isActive: true,
      assignedLabs: [],
      assignedClasses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  // Hydrate from Supabase Cloud (Strictly skip any permanently deleted users)
  if (sb) {
    try {
      // 0. Synchronize cloud tombstones first
      await syncCloudTombstones();

      // 1. Hydrate extended cache if available
      const { data: cacheSetting } = await sb
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'users_extended_cache')
        .maybeSingle();

      if (cacheSetting && cacheSetting.setting_value) {
        try {
          const parsed = JSON.parse(cacheSetting.setting_value);
          if (parsed && Array.isArray(parsed.users)) {
            const userStore = db.getStore('users');
            for (const u of parsed.users) {
              if (db.isDeleted(u.id) || (u.email && db.isDeleted(u.email))) continue; // Never resurrect permanently deleted users
              const existing = userStore.find(eu => eu.id === u.id || eu.email.toLowerCase() === u.email.toLowerCase());
              if (!existing) {
                userStore.push({
                  ...u,
                  passwordHash: u.passwordHash || bcrypt.hashSync('User@123', salt)
                });
              } else {
                if (u.department) existing.department = u.department;
                if (u.assignedLabs) existing.assignedLabs = u.assignedLabs;
                if (u.assignedClasses) existing.assignedClasses = u.assignedClasses;
                if (u.phone) existing.phone = u.phone;
                if (u.identifier) existing.identifier = u.identifier;
              }
            }
          }
          if (parsed && Array.isArray(parsed.students)) {
            const studentStore = db.getStore('students');
            for (const s of parsed.students) {
              if (db.isDeleted(s.id) || (s.userId && db.isDeleted(s.userId))) continue;
              const existingS = studentStore.find(es => es.id === s.id || es.userId === s.userId || es.studentId === s.studentId);
              if (!existingS) {
                studentStore.push(s);
              } else {
                Object.assign(existingS, s);
              }
            }
          }
        } catch (e: any) {
          console.warn('[Users Cache] Error parsing extended cache:', e.message);
        }
      }

      // 2. Hydrate users table directly with bidirectional deletion enforcement
      const { data: supaUsers } = await sb.from('users').select('*');
      if (supaUsers) {
        const store = db.getStore('users');
        const supaUserIds = new Set(supaUsers.map(u => u.id));
        const supaUserEmails = new Set(supaUsers.map(u => (u.email || '').toLowerCase()));

        // If a user was deleted directly in Supabase (not in supaUsers list), purge locally
        if (supaUsers.length > 0) {
          const purged = store.filter(u => {
            if (u.role === 'ADMIN' && u.email === 'admin@labguard.edu') return true;
            if (db.isDeleted(u.id) || (u.email && db.isDeleted(u.email))) return false;
            if (!supaUserIds.has(u.id) && !supaUserEmails.has((u.email || '').toLowerCase())) {
              db.recordDeletion(u.id, 'USER', { email: u.email, reason: 'DELETED_FROM_SUPABASE' });
              return false;
            }
            return true;
          });
          store.length = 0;
          store.push(...purged);
        }

        for (const u of supaUsers) {
          if (db.isDeleted(u.id) || (u.email && db.isDeleted(u.email))) continue;
          const existing = store.find(eu => eu.id === u.id || eu.email.toLowerCase() === u.email.toLowerCase());
          const roleName = u.role_id === roleIdMap.ADMIN ? 'ADMIN'
            : u.role_id === roleIdMap.FACULTY ? 'FACULTY'
            : u.role_id === roleIdMap.LAB_ASSISTANT ? 'LAB_ASSISTANT'
            : 'STUDENT';

          if (!existing) {
            store.push({
              id: u.id,
              email: u.email,
              passwordHash: u.password_hash || bcrypt.hashSync('User@123', salt),
              fullName: u.full_name,
              role: roleName,
              phone: u.phone,
              identifier: u.email,
              department: 'General',
              isActive: u.is_active !== false,
              assignedLabs: [],
              assignedClasses: [],
              createdAt: u.created_at,
              updatedAt: u.updated_at
            });
          } else {
            existing.role = roleName;
            if (u.full_name) existing.fullName = u.full_name;
            if (u.phone) existing.phone = u.phone;
            existing.isActive = u.is_active !== false;
          }
        }
      }

      // 3. Hydrate students table directly
      const { data: supaStudents } = await sb.from('students').select('*');
      if (supaStudents && supaStudents.length > 0) {
        const studentStore = db.getStore('students');
        for (const s of supaStudents) {
          const existing = studentStore.find(es => es.id === s.id || es.userId === s.user_id || es.studentId === s.student_id);
          if (!existing) {
            studentStore.push({
              id: s.id,
              userId: s.user_id,
              studentId: s.student_id || s.roll_number,
              department: s.department || 'Computer Science',
              course: s.course || 'B.Tech',
              yearOfStudy: s.year_of_study || 1,
              semester: s.semester || 1,
              section: s.section || 'A',
              academicYear: `${s.admission_year || 2026}-${(s.admission_year || 2026) + 1}`,
              createdAt: s.created_at
            });
          } else {
            if (s.department) existing.department = s.department;
            if (s.course) existing.course = s.course;
            if (s.year_of_study) existing.yearOfStudy = s.year_of_study;
            if (s.semester) existing.semester = s.semester;
            if (s.section) existing.section = s.section;
          }
        }
      }

      // 4. Ensure strictly that the primary institutional Admin account is present in Supabase if missing
      const admin = db.findOne<any>('users', (u) => u.role === 'ADMIN' && u.email === 'admin@labguard.edu');
      if (admin) {
        await sb.from('users').upsert({
          id: admin.id,
          email: admin.email,
          password_hash: admin.passwordHash,
          full_name: admin.fullName,
          role_id: roleIdMap.ADMIN,
          phone: admin.phone || null,
          is_active: true,
          created_at: admin.createdAt,
          updated_at: admin.updatedAt
        }, { onConflict: 'email' });
      }

      await syncExtendedUserCacheToSupabase();
    } catch (e: any) {
      console.warn('[Users Supabase] Bootstrapping hydration error:', e.message);
    }
  }
};
ensureBootstrapInstitutionalUsers();

export const login = async (req: Request, res: Response) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Identifier and password are required'
    });
  }

  // Find user by email or student/employee identifier
  const user = db.findOne<any>('users', (u) => {
    if (u.email.toLowerCase() === identifier.toLowerCase()) return true;
    if (u.identifier && u.identifier.toLowerCase() === identifier.toLowerCase()) return true;
    return false;
  });

  if (!user) {
    recordFailedLogin(req);
    db.insert('audit_logs', {
      id: uuidv4(),
      actorUserId: 'ANONYMOUS',
      actorName: identifier,
      role: role || 'UNKNOWN',
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: identifier,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials or unassigned role'
    });
  }

  if (!user.isActive) {
    recordFailedLogin(req);
    db.insert('audit_logs', {
      id: uuidv4(),
      actorUserId: user.id,
      actorName: user.fullName,
      role: user.role,
      action: 'LOGIN_FAILED_DEACTIVATED',
      entityType: 'AUTH',
      entityId: user.id,
      timestamp: new Date().toISOString()
    });
    return res.status(403).json({
      success: false,
      error: 'ACCOUNT_DISABLED',
      message: 'Institutional account has been suspended or deactivated'
    });
  }

  if (role && user.role !== role) {
    recordFailedLogin(req);
    return res.status(401).json({
      success: false,
      error: 'ROLE_MISMATCH',
      message: `User is not provisioned under the ${role} role`
    });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isPasswordValid) {
    recordFailedLogin(req);
    db.insert('audit_logs', {
      id: uuidv4(),
      actorUserId: user.id,
      actorName: user.fullName,
      role: user.role,
      action: 'LOGIN_FAILED_CREDENTIALS',
      entityType: 'AUTH',
      entityId: user.id,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials or unassigned role'
    });
  }

  // Clear rate-limiting records on verified login
  clearFailedLogin(req);

  // Generate tokens
  const tokenPayload = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    identifier: user.identifier || user.email,
    assignedLabs: user.assignedLabs || [],
    assignedClasses: user.assignedClasses || []
  };

  const accessToken = jwt.sign(tokenPayload, ENV.JWT_SECRET, { expiresIn: '8h' });
  const refreshToken = jwt.sign({ id: user.id }, ENV.JWT_SECRET, { expiresIn: '7d' });
  const offlineToken = jwt.sign(tokenPayload, ENV.OFFLINE_TOKEN_SECRET, { expiresIn: '30d' });

  // Record audit
  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: user.id,
    actorName: user.fullName,
    role: user.role,
    action: 'USER_LOGIN',
    entityType: 'AUTH',
    entityId: user.id,
    timestamp: new Date().toISOString()
  });

  const response: AuthResponse = {
    accessToken,
    refreshToken,
    offlineToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    authorizedLabs: user.assignedLabs,
    authorizedClasses: user.assignedClasses
  };

  return res.json({ success: true, data: response });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Refresh token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string };
    const user = db.findOne<any>('users', (u) => u.id === decoded.id);

    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: 'Account is inactive or does not exist'
      });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      identifier: user.identifier || user.email,
      assignedLabs: user.assignedLabs || [],
      assignedClasses: user.assignedClasses || []
    };

    const newAccessToken = jwt.sign(tokenPayload, ENV.JWT_SECRET, { expiresIn: '8h' });
    const newRefreshToken = jwt.sign({ id: user.id }, ENV.JWT_SECRET, { expiresIn: '7d' });
    const newOfflineToken = jwt.sign(tokenPayload, ENV.OFFLINE_TOKEN_SECRET, { expiresIn: '30d' });

    db.insert('audit_logs', {
      id: uuidv4(),
      actorUserId: user.id,
      actorName: user.fullName,
      role: user.role,
      action: 'TOKEN_REFRESH',
      entityType: 'AUTH',
      entityId: user.id,
      timestamp: new Date().toISOString()
    });

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        offlineToken: newOfflineToken
      }
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Refresh token has expired or is invalid'
    });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });

  const user = db.findOne<User>('users', (u) => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: 'NOT_FOUND' });

  return res.json({ success: true, data: user });
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  const {
    email,
    password,
    fullName,
    role,
    identifier,
    department,
    phone,
    dateOfBirth,
    gender,
    course,
    yearOfStudy,
    semester,
    section,
    academicYear,
    assignedLabs
  } = req.body;

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Missing required user fields' });
  }

  const existing = db.findOne<User>('users', (u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_USER', message: 'User with this email already exists' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const userId = uuidv4();

  const newUser = {
    id: userId,
    email,
    passwordHash,
    fullName,
    role: role as UserRole,
    identifier: identifier || email,
    department: department || 'General',
    phone: phone || '',
    assignedLabs: assignedLabs || [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.insert('users', newUser);

  let createdStudentProfile: any = null;
  // If Student, create student profile
  if (role === 'STUDENT') {
    const studentIdVal = identifier || `STU-${Date.now().toString().slice(-4)}`;
    createdStudentProfile = {
      id: uuidv4(),
      userId,
      studentId: studentIdVal,
      department: department || 'Computer Science',
      course: course || 'B.Tech',
      yearOfStudy: yearOfStudy ? parseInt(yearOfStudy.toString(), 10) : 1,
      semester: semester ? parseInt(semester.toString(), 10) : 1,
      section: section || 'A',
      academicYear: academicYear || '2026-2027',
      dateOfBirth: dateOfBirth || '',
      gender: gender || 'Unspecified',
      createdAt: new Date().toISOString()
    };
    db.insert('students', createdStudentProfile);
  }

  // Direct Two-Way Supabase Sync
  const sb = getSupabase();
  if (sb) {
    try {
      const roleIdMap: Record<string, string> = {
        ADMIN: '10000000-0000-0000-0000-000000000001',
        FACULTY: '10000000-0000-0000-0000-000000000002',
        LAB_ASSISTANT: '10000000-0000-0000-0000-000000000003',
        STUDENT: '10000000-0000-0000-0000-000000000004'
      };

      await sb.from('users').upsert({
        id: userId,
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role_id: roleIdMap[role] || roleIdMap.STUDENT,
        phone: phone || null,
        is_active: true,
        created_at: newUser.createdAt,
        updated_at: newUser.updatedAt
      }, { onConflict: 'email' });

      if (role === 'STUDENT' && createdStudentProfile) {
        await sb.from('students').upsert({
          id: createdStudentProfile.id,
          user_id: userId,
          student_id: createdStudentProfile.studentId,
          department: createdStudentProfile.department,
          course: createdStudentProfile.course,
          year_of_study: createdStudentProfile.yearOfStudy,
          semester: createdStudentProfile.semester,
          section: createdStudentProfile.section,
          admission_year: new Date().getFullYear(),
          roll_number: createdStudentProfile.studentId,
          created_at: createdStudentProfile.createdAt
        }, { onConflict: 'student_id' });
      } else if (role === 'FACULTY') {
        await sb.from('faculty').upsert({
          id: uuidv4(),
          user_id: userId,
          employee_id: `FAC-${userId.slice(0, 8).toUpperCase()}`,
          department: newUser.department || 'General',
          designation: 'Faculty Member'
        }, { onConflict: 'user_id' });
      } else if (role === 'LAB_ASSISTANT') {
        await sb.from('lab_assistants').upsert({
          id: uuidv4(),
          user_id: userId,
          employee_id: `ASST-${userId.slice(0, 8).toUpperCase()}`,
          department: newUser.department || 'General'
        }, { onConflict: 'user_id' });
      }

      await syncExtendedUserCacheToSupabase();
    } catch (e: any) {
      console.warn('[Supabase Sync] Create user error:', e.message);
    }
  }

  // Audit
  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    role: req.user!.role,
    action: 'USER_CREATED',
    entityType: 'USER',
    entityId: userId,
    timestamp: new Date().toISOString()
  });

  return res.status(201).json({
    success: true,
    data: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      identifier: newUser.identifier,
      department: newUser.department,
      assignedLabs: newUser.assignedLabs,
      isActive: newUser.isActive
    }
  });
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const {
    fullName,
    email,
    identifier,
    department,
    phone,
    assignedLabs,
    role,
    dateOfBirth,
    gender,
    course,
    yearOfStudy,
    semester,
    section,
    academicYear
  } = req.body;

  const user = db.findOne<any>('users', (u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found' });
  }

  if (fullName !== undefined) user.fullName = fullName;
  if (email !== undefined) user.email = email;
  if (identifier !== undefined) user.identifier = identifier;
  if (department !== undefined) user.department = department;
  if (phone !== undefined) user.phone = phone;
  if (assignedLabs !== undefined) user.assignedLabs = assignedLabs;
  if (role !== undefined) user.role = role;
  user.updatedAt = new Date().toISOString();

  // If student, update or create student profile
  let student = db.findOne<any>('students', (s) => s.userId === userId);
  if (user.role === 'STUDENT') {
    if (student) {
      if (department !== undefined) student.department = department;
      if (course !== undefined) student.course = course;
      if (yearOfStudy !== undefined) student.yearOfStudy = parseInt(yearOfStudy.toString(), 10);
      if (semester !== undefined) student.semester = parseInt(semester.toString(), 10);
      if (section !== undefined) student.section = section;
      if (academicYear !== undefined) student.academicYear = academicYear;
      if (dateOfBirth !== undefined) student.dateOfBirth = dateOfBirth;
      if (gender !== undefined) student.gender = gender;
    } else {
      student = {
        id: uuidv4(),
        userId,
        studentId: user.identifier,
        department: user.department || 'General',
        course: course || 'General',
        yearOfStudy: yearOfStudy ? parseInt(yearOfStudy.toString(), 10) : 1,
        semester: semester ? parseInt(semester.toString(), 10) : 1,
        section: section || 'A',
        academicYear: academicYear || '2026-2027',
        dateOfBirth: dateOfBirth || '',
        gender: gender || 'Unspecified',
        createdAt: new Date().toISOString()
      };
      db.insert('students', student);
    }
  }

  // Supabase Sync
  const sb = getSupabase();
  if (sb) {
    try {
      const roleIdMap: Record<string, string> = {
        ADMIN: '10000000-0000-0000-0000-000000000001',
        FACULTY: '10000000-0000-0000-0000-000000000002',
        LAB_ASSISTANT: '10000000-0000-0000-0000-000000000003',
        STUDENT: '10000000-0000-0000-0000-000000000004'
      };

      await sb.from('users').update({
        email: user.email,
        full_name: user.fullName,
        role_id: roleIdMap[user.role] || roleIdMap.STUDENT,
        phone: user.phone || null,
        updated_at: user.updatedAt
      }).eq('id', user.id);

      if (user.role === 'STUDENT' && student) {
        await sb.from('students').upsert({
          id: student.id,
          user_id: user.id,
          student_id: student.studentId,
          department: student.department || 'General',
          course: student.course || 'B.Tech',
          year_of_study: student.yearOfStudy || 1,
          semester: student.semester || 1,
          section: student.section || 'A',
          admission_year: 2026,
          roll_number: student.studentId,
          created_at: student.createdAt || new Date().toISOString()
        }, { onConflict: 'student_id' });
      }

      await syncExtendedUserCacheToSupabase();
    } catch (e: any) {
      console.warn('[Supabase Sync] Update user error:', e.message);
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    role: req.user!.role,
    action: 'USER_UPDATED',
    entityType: 'USER',
    entityId: userId,
    timestamp: new Date().toISOString()
  });

  return res.json({ success: true, data: user });
};

export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  const user = db.findOne<any>('users', (u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found' });
  }

  // Prevent disabling the primary administrator account
  if (user.email === 'admin@labguard.edu') {
    return res.status(400).json({
      success: false,
      error: 'CANNOT_DISABLE_ROOT',
      message: 'The primary institutional administrator account cannot be disabled'
    });
  }

  user.isActive = typeof isActive === 'boolean' ? isActive : !user.isActive;
  user.updatedAt = new Date().toISOString();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('users').update({ is_active: user.isActive, updated_at: user.updatedAt }).eq('id', user.id);
      await syncExtendedUserCacheToSupabase();
    } catch (e: any) {
      console.warn('[Supabase Sync] Toggle status error:', e.message);
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    role: req.user!.role,
    action: user.isActive ? 'USER_ACTIVATED' : 'USER_DISABLED',
    entityType: 'USER',
    entityId: userId,
    timestamp: new Date().toISOString()
  });

  return res.json({
    success: true,
    data: { id: user.id, email: user.email, isActive: user.isActive }
  });
};

export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
  const roleFilter = req.query.role as UserRole;
  const search = (req.query.search as string || '').toLowerCase().trim();
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '20', 10);

  const students = db.getStore('students');

  let users = db.getStore('users')
    .filter((u) => !db.isDeleted(u.id) && !db.isDeleted(u.email))
    .map((u) => {
    const student = u.role === 'STUDENT' ? students.find((s: any) => s.userId === u.id) : null;
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      identifier: u.identifier,
      department: u.department,
      phone: u.phone,
      assignedLabs: u.assignedLabs || [],
      isActive: u.isActive,
      studentProfile: student || undefined,
      createdAt: u.createdAt
    };
  });

  if (roleFilter) {
    users = users.filter((u) => u.role === roleFilter);
  }

  if (search) {
    users = users.filter((u) =>
      u.fullName.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      (u.identifier && u.identifier.toLowerCase().includes(search)) ||
      (u.department && u.department.toLowerCase().includes(search))
    );
  }

  const total = users.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedUsers = users.slice((page - 1) * limit, page * limit);

  return res.json({
    success: true,
    data: paginatedUsers,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  });
};

export const verifyOfflineToken = async (req: Request, res: Response) => {
  const { offlineToken } = req.body;
  if (!offlineToken) {
    return res.status(400).json({
      success: false,
      error: 'TOKEN_REQUIRED',
      message: 'offlineToken parameter is required'
    });
  }

  try {
    const decoded = jwt.verify(offlineToken, ENV.OFFLINE_TOKEN_SECRET);
    return res.json({
      success: true,
      data: {
        valid: true,
        payload: decoded
      }
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_OFFLINE_TOKEN',
      message: err.message || 'Offline token is invalid or has expired'
    });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const user = db.findOne('users', (u) => u.id === userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'Specified user does not exist'
    });
  }

  // Prevent deleting primary admin or self
  if (user.role === 'ADMIN' && (user.email === 'admin@labguard.edu' || user.email === 'admin@institution.edu' || user.id === 'user-admin-01' || user.id === req.user?.id)) {
    return res.status(403).json({
      success: false,
      error: 'CANNOT_DELETE_PRIMARY_ADMIN',
      message: 'Primary institutional administrator or currently active administrator account cannot be deleted'
    });
  }

  // Cleanup students profile if applicable
  db.delete('students', (s: any) => s.userId === userId);
  // Delete user account
  db.delete('users', (u: any) => u.id === userId);
  // Record permanent tombstone locally & in Supabase cloud so user cannot be resurrected by background sync
  await recordCloudDeletion(userId, 'USER', { email: user.email, identifier: user.identifier });

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('students').delete().eq('user_id', userId);
      await sb.from('faculty').delete().eq('user_id', userId);
      await sb.from('lab_assistants').delete().eq('user_id', userId);
      await sb.from('users').delete().eq('id', userId);
    } catch (err: any) {
      console.warn('[Auth Supabase] Delete user error:', err.message);
    }
  }

  // Update cloud cache so user is permanently removed and not resurrected
  await syncExtendedUserCacheToSupabase();

  try {
    RealtimeService.broadcast('USER_DELETED', { userId, email: user.email });
  } catch {}

  // Audit record
  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: req.user?.id || 'system',
    actorName: req.user?.fullName || 'Administrator',
    role: req.user?.role || 'ADMIN',
    action: 'USER_DELETED',
    entityType: 'USER',
    entityId: userId,
    details: {
      deletedUserEmail: user.email,
      deletedUserName: user.fullName,
      deletedRole: user.role,
      deletedIdentifier: user.identifier
    },
    timestamp: new Date().toISOString()
  });

  return res.json({
    success: true,
    message: `User ${user.fullName} (${user.email || user.identifier}) permanently removed`,
    data: { id: userId }
  });
};

/**
 * Validates Staff / Faculty / Lab Assistant / Administrator password dynamically
 * so that any registered staff user's login password serves as a valid Staff Exit Key.
 * Student passwords are systematically denied exit authorization.
 */
export const verifyStaffExit = async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Password or PIN is required'
    });
  }

  const cleanPass = password.trim();

  // 1. Check default seeded staff passwords (fallback before full search)
  if (
    cleanPass === 'Admin@123456' ||
    cleanPass === 'Faculty@123456' ||
    cleanPass === 'Assistant@123456'
  ) {
    return res.json({
      success: true,
      data: {
        role: 'STAFF',
        name: 'Authorized Staff Member',
        message: 'Exit authorized via Staff Credentials'
      }
    });
  }

  // 2. Search all registered users in database
  const allUsers = db.getStore('users') || [];

  // Check against all active STAFF users (FACULTY, LAB_ASSISTANT, ADMIN)
  const matchingStaff = allUsers.find(
    (u: any) =>
      u.isActive !== false &&
      (u.role === 'FACULTY' || u.role === 'LAB_ASSISTANT' || u.role === 'ADMIN') &&
      u.passwordHash &&
      bcrypt.compareSync(cleanPass, u.passwordHash)
  );

  if (matchingStaff) {
    db.insert('audit_logs', {
      id: uuidv4(),
      actorUserId: matchingStaff.id,
      actorName: matchingStaff.fullName,
      role: matchingStaff.role,
      action: 'STAFF_KIOSK_EXIT_AUTHORIZED',
      entityType: 'TERMINAL',
      entityId: req.ip || 'TERMINAL',
      details: {
        staffRole: matchingStaff.role,
        staffName: matchingStaff.fullName,
        email: matchingStaff.email
      },
      timestamp: new Date().toISOString()
    });

    return res.json({
      success: true,
      data: {
        role: matchingStaff.role,
        name: matchingStaff.fullName,
        message: `Exit authorized by ${matchingStaff.role} (${matchingStaff.fullName})`
      }
    });
  }

  // Check if password belongs to a STUDENT
  const matchingStudent = allUsers.find(
    (u: any) =>
      u.role === 'STUDENT' &&
      u.passwordHash &&
      bcrypt.compareSync(cleanPass, u.passwordHash)
  );

  if (matchingStudent) {
    return res.status(403).json({
      success: false,
      error: 'STUDENT_UNAUTHORIZED',
      message: 'Student accounts are not authorized to exit the terminal.'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'INVALID_CREDENTIALS',
    message: 'Invalid Staff Password or PIN. Access Denied.'
  });
};



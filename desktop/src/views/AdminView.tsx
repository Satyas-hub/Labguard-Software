import React, { useState, useEffect } from 'react';
import { ApiClient } from '../services/api';
import { NativeService } from '../services/native';
import { LocalDbService } from '../db/localDb';
import {
  LayoutDashboard, Users, Monitor, Building2, BookOpen,
  ClipboardList, Settings, Plus, RefreshCw, AlertTriangle, CheckCircle2,
  Search, Filter, Edit2, UserCheck, UserX, ChevronLeft, ChevronRight, X, Shield, Lock,
  GraduationCap, Layers, Calendar, Trash2, BookMarked, Check,
  MapPin, HardDrive, Wifi, WifiOff, Cpu, Laptop, UserPlus, CheckSquare, Square,
  Power, Unlink, Activity, Tag, Package, ArrowRightLeft, Wrench, History, Headphones, BatteryCharging,
  Clock, FileText, CheckCheck, XCircle, Download
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'people' | 'labs' | 'academic' | 'enrollment' | 'audit' | 'settings'>('overview');
  const [pcIdentity, setPcIdentity] = useState<any>({
    lab_code: '',
    pc_code: '',
    client_id: '',
    is_registered: false
  });
  const [rebindSuccess, setRebindSuccess] = useState(false);

  useEffect(() => {
    NativeService.getPcIdentity().then(id => {
      if (id) setPcIdentity(id);
    });
  }, []);
  const [metrics, setMetrics] = useState<any>({
    totalStudents: 0,
    totalFaculty: 0,
    totalLabAssistants: 0,
    totalLabs: 0,
    totalComputers: 0,
    totalEquipment: 0,
    activeSessions: 0,
    openIssues: 0,
    onlineClients: 0,
    offlineClients: 0
  });
  const [users, setUsers] = useState<any[]>([]);
  const [userPagination, setUserPagination] = useState<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'FACULTY' | 'LAB_ASSISTANT' | 'ADMIN'>('ALL');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields (Enterprise 2-Column User Provisioning)
  // Column 1: Identity & Credentials
  const [formRole, setFormRole] = useState<'STUDENT' | 'FACULTY' | 'LAB_ASSISTANT' | 'ADMIN'>('STUDENT');
  const [formFullName, setFormFullName] = useState('');
  const [formDateOfBirth, setFormDateOfBirth] = useState('');
  const [formGender, setFormGender] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIdentifier, setFormIdentifier] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Column 2: Academic & Laboratory Assignment
  const [formDepartment, setFormDepartment] = useState('');
  const [formCourse, setFormCourse] = useState('');
  const [formYearOfStudy, setFormYearOfStudy] = useState<number | ''>('');
  const [formSemester, setFormSemester] = useState<number | ''>('');
  const [formSection, setFormSection] = useState('');
  const [formAcademicYear, setFormAcademicYear] = useState('');
  const [formAssignedLabs, setFormAssignedLabs] = useState<string[]>([]);

  // ==========================================================================
  // Academic Management States (Phase 5)
  // ==========================================================================
  const [academicSubTab, setAcademicSubTab] = useState<'departments' | 'subjects' | 'classes' | 'calendar'>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  const [academicSearch, setAcademicSearch] = useState('');

  // Academic Modals
  const [academicModal, setAcademicModal] = useState<'DEPT' | 'COURSE' | 'SUBJECT' | 'CLASS' | 'YEAR' | 'SECTION' | null>(null);
  const [academicModalMode, setAcademicModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingAcademicId, setEditingAcademicId] = useState<string | null>(null);
  const [academicFormError, setAcademicFormError] = useState<string | null>(null);
  const [academicSubmitting, setAcademicSubmitting] = useState(false);

  // Academic Form inputs
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseDeptId, setCourseDeptId] = useState('');
  const [courseDegreeLevel, setCourseDegreeLevel] = useState('Undergraduate');

  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectDeptId, setSubjectDeptId] = useState('');
  const [subjectSemester, setSubjectSemester] = useState<number>(1);
  const [subjectCredits, setSubjectCredits] = useState<number>(2);

  const [yearString, setYearString] = useState('');
  const [yearIsCurrent, setYearIsCurrent] = useState(false);
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');

  const [sectionName, setSectionName] = useState('');

  const [className, setClassName] = useState('');
  const [classCourseId, setClassCourseId] = useState('');
  const [classSubjectId, setClassSubjectId] = useState('');
  const [classYear, setClassYear] = useState('2025-2026');
  const [classSemester, setClassSemester] = useState<number>(1);
  const [classSection, setClassSection] = useState('A');
  const [classFacultyId, setClassFacultyId] = useState('');
  const [classLabCode, setClassLabCode] = useState('');
  const [classEnrollmentPolicy, setClassEnrollmentPolicy] = useState<'DIRECT' | 'APPROVAL_REQUIRED'>('DIRECT');
  const [classCapacity, setClassCapacity] = useState<number>(40);

  // ==========================================================================
  // Student Enrollment & Request Triage States (Phase 10)
  // ==========================================================================
  const [enrollmentSubView, setEnrollmentSubView] = useState<'requests' | 'rosters' | 'students'>('requests');
  const [enrollmentRequests, setEnrollmentRequests] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestClassFilter, setRequestClassFilter] = useState('ALL');

  // Class Rosters
  const [selectedClassForRoster, setSelectedClassForRoster] = useState<string>('');
  const [classRosterStudents, setClassRosterStudents] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotesInput, setReviewNotesInput] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Direct Student Enrollment Modal
  const [directEnrollModalOpen, setDirectEnrollModalOpen] = useState(false);
  const [enrollTargetClassId, setEnrollTargetClassId] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<any[]>([]);
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState<any | null>(null);
  const [enrollNotesInput, setEnrollNotesInput] = useState('');
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // All Students Directory
  const [allStudentsList, setAllStudentsList] = useState<any[]>([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);
  const [studentDirSearch, setStudentDirSearch] = useState('');
  const [studentDirDeptFilter, setStudentDirDeptFilter] = useState('ALL');

  const [labs, setLabs] = useState<any[]>([]);
  const [computers, setComputers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState('ALL');
  const [auditEntityFilter, setAuditEntityFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // ==========================================================================
  // Lab & Workstation Fleet Management States (Phase 6)
  // ==========================================================================
  const [labSubView, setLabSubView] = useState<'facilities' | 'workstations' | 'equipment'>('facilities');
  const [labSearch, setLabSearch] = useState('');
  const [labStatusFilter, setLabStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ALL');
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [selectedLabForWorkstations, setSelectedLabForWorkstations] = useState<string>('ALL');
  const [pcStateFilter, setPcStateFilter] = useState<string>('ALL');

  // Lab Modals
  const [labModalMode, setLabModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [labFormError, setLabFormError] = useState<string | null>(null);
  const [labFormSubmitting, setLabFormSubmitting] = useState(false);

  // Lab Form inputs
  const [labCodeInput, setLabCodeInput] = useState('');
  const [labNameInput, setLabNameInput] = useState('');
  const [labBuildingInput, setLabBuildingInput] = useState('');
  const [labRoomInput, setLabRoomInput] = useState('');
  const [labCapacityInput, setLabCapacityInput] = useState<number>(30);
  const [labDescInput, setLabDescInput] = useState('');
  const [labStatusInput, setLabStatusInput] = useState<'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ACTIVE');

  // Staff Assignment Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalLab, setStaffModalLab] = useState<any | null>(null);
  const [allStaffCandidates, setAllStaffCandidates] = useState<any[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffFilterSearch, setStaffFilterSearch] = useState('');
  const [staffModalSubmitting, setStaffModalSubmitting] = useState(false);
  const [staffModalError, setStaffModalError] = useState<string | null>(null);

  // Dependency Alert Modal on Delete
  const [deleteDependencyAlert, setDeleteDependencyAlert] = useState<{
    open: boolean;
    labCode: string;
    message: string;
    dependencies?: {
      computersCount: number;
      classesCount: number;
      sessionsCount: number;
    };
  } | null>(null);

  const fetchLabsData = async (search = labSearch, status = labStatusFilter) => {
    setLoadingLabs(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (status && status !== 'ALL') query.set('status', status);
      const lRes = await ApiClient.request(`/labs?${query.toString()}`);
      if (lRes.success && lRes.data) {
        setLabs(lRes.data);
      }
      const cRes = await ApiClient.request('/computers');
      if (cRes.success && cRes.data) {
        setComputers(cRes.data);
      }
      const eRes = await ApiClient.request('/equipment');
      if (eRes.success && eRes.data) {
        setEquipment(eRes.data);
      }
    } finally {
      setLoadingLabs(false);
    }
  };

  const openCreateLabModal = () => {
    setLabModalMode('CREATE');
    setEditingLabId(null);
    setLabCodeInput('');
    setLabNameInput('');
    setLabBuildingInput('Main Science Building');
    setLabRoomInput('');
    setLabCapacityInput(30);
    setLabDescInput('');
    setLabStatusInput('ACTIVE');
    setLabFormError(null);
  };

  const openEditLabModal = (lab: any) => {
    setLabModalMode('EDIT');
    setEditingLabId(lab.id);
    setLabCodeInput(lab.code);
    setLabNameInput(lab.name);
    setLabBuildingInput(lab.building || '');
    setLabRoomInput(lab.room || '');
    setLabCapacityInput(lab.capacity || 30);
    setLabDescInput(lab.description || '');
    setLabStatusInput(lab.status || 'ACTIVE');
    setLabFormError(null);
  };

  const handleLabFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labCodeInput.trim() || !labNameInput.trim() || !labRoomInput.trim()) {
      setLabFormError('Lab code, name, and room number are required');
      return;
    }
    setLabFormSubmitting(true);
    setLabFormError(null);

    const payload = {
      code: labCodeInput.trim(),
      name: labNameInput.trim(),
      building: labBuildingInput.trim(),
      room: labRoomInput.trim(),
      capacity: Number(labCapacityInput) || 30,
      description: labDescInput.trim(),
      status: labStatusInput
    };

    let res;
    if (labModalMode === 'CREATE') {
      res = await ApiClient.request('/labs', { method: 'POST', body: JSON.stringify(payload) });
    } else {
      res = await ApiClient.request(`/labs/${editingLabId}`, { method: 'PUT', body: JSON.stringify(payload) });
    }

    setLabFormSubmitting(false);
    if (res.success) {
      setLabModalMode(null);
      await fetchLabsData();
    } else {
      setLabFormError(res.message || res.error || 'Failed to save laboratory');
    }
  };

  const handleDeleteLab = async (lab: any) => {
    if (!window.confirm(`Are you sure you want to delete laboratory '${lab.code}' (${lab.name})?`)) {
      return;
    }

    const res = await ApiClient.request(`/labs/${lab.id}`, { method: 'DELETE' });
    if (res.success) {
      await LocalDbService.deleteLab(lab.id, lab.code);
      await fetchLabsData();
    } else {
      if (res.error === 'CANNOT_DELETE_HAS_DEPENDENCIES') {
        const anyRes = res as any;
        setDeleteDependencyAlert({
          open: true,
          labCode: lab.code,
          message: anyRes.message || 'Cannot delete laboratory due to active dependencies.',
          dependencies: anyRes.dependencies
        });
      } else {
        alert(res.message || res.error || 'Failed to delete laboratory');
      }
    }
  };

  const openStaffModal = async (lab: any) => {
    setStaffModalLab(lab);
    setStaffModalError(null);
    setStaffFilterSearch('');

    const currentIds = (lab.assignedStaff || []).map((s: any) => s.id);
    setSelectedStaffIds(currentIds);

    const [fRes, aRes] = await Promise.all([
      ApiClient.request('/users?role=FACULTY&limit=100'),
      ApiClient.request('/users?role=LAB_ASSISTANT&limit=100')
    ]);

    const faculty = (fRes.success && fRes.data) ? (Array.isArray(fRes.data) ? fRes.data : fRes.data.users || []) : [];
    const assistants = (aRes.success && aRes.data) ? (Array.isArray(aRes.data) ? aRes.data : aRes.data.users || []) : [];

    setAllStaffCandidates([...faculty, ...assistants]);
    setStaffModalOpen(true);
  };

  const toggleStaffSelection = (userId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveStaffAssignments = async () => {
    if (!staffModalLab) return;
    setStaffModalSubmitting(true);
    setStaffModalError(null);

    const res = await ApiClient.request(`/labs/${staffModalLab.id}/staff`, {
      method: 'POST',
      body: JSON.stringify({ staffIds: selectedStaffIds })
    });

    setStaffModalSubmitting(false);
    if (res.success) {
      setStaffModalOpen(false);
      await fetchLabsData();
    } else {
      setStaffModalError(res.message || res.error || 'Failed to update staff assignments');
    }
  };

  // ==========================================================================
  // Workstation Fleet Management Handlers (Phase 7)
  // ==========================================================================
  const [pcModalMode, setPcModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [editingPcId, setEditingPcId] = useState<string | null>(null);
  const [pcFormLabCode, setPcFormLabCode] = useState('');
  const [pcFormCode, setPcFormCode] = useState('');
  const [pcFormHostname, setPcFormHostname] = useState('');
  const [pcFormIp, setPcFormIp] = useState('');
  const [pcFormMac, setPcFormMac] = useState('');
  const [pcFormState, setPcFormState] = useState<string>('AVAILABLE');
  const [pcFormCpu, setPcFormCpu] = useState('Intel Core i7-13700 / AMD Ryzen 7');
  const [pcFormRam, setPcFormRam] = useState<number>(16);
  const [pcFormDisk, setPcFormDisk] = useState<number>(512);
  const [pcFormError, setPcFormError] = useState<string | null>(null);
  const [pcFormSubmitting, setPcFormSubmitting] = useState(false);

  const openCreatePcModal = () => {
    setPcModalMode('CREATE');
    setEditingPcId(null);
    const defaultLab = selectedLabForWorkstations !== 'ALL' ? selectedLabForWorkstations : (labs[0]?.code || 'LAB-01');
    setPcFormLabCode(defaultLab);
    const labPcs = computers.filter(c => c.labCode === defaultLab);
    const nextNum = labPcs.length + 1;
    const pcCode = `PC-${nextNum < 10 ? '0' : ''}${nextNum}`;
    setPcFormCode(pcCode);
    setPcFormHostname(`${defaultLab}-${pcCode}`);
    setPcFormIp('');
    setPcFormMac('');
    setPcFormState('AVAILABLE');
    setPcFormCpu('Intel Core i7-13700 / AMD Ryzen 7');
    setPcFormRam(16);
    setPcFormDisk(512);
    setPcFormError(null);
  };

  const openEditPcModal = (pc: any) => {
    setPcModalMode('EDIT');
    setEditingPcId(pc.id);
    setPcFormLabCode(pc.labCode || labs[0]?.code || 'LAB-01');
    setPcFormCode(pc.pcCode);
    setPcFormHostname(pc.hostname || '');
    setPcFormIp(pc.ipAddress || '');
    setPcFormMac(pc.macAddress || '');
    setPcFormState(pc.state || 'AVAILABLE');
    setPcFormCpu(pc.hardwareInfo?.cpuModel || 'Intel Core i7-13700 / AMD Ryzen 7');
    setPcFormRam(pc.hardwareInfo?.ramGb || 16);
    setPcFormDisk(pc.hardwareInfo?.diskGb || 512);
    setPcFormError(null);
  };

  const handlePcFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcFormLabCode || !pcFormCode.trim()) {
      setPcFormError('Laboratory and Workstation Code are required');
      return;
    }
    setPcFormSubmitting(true);
    setPcFormError(null);

    const payload = {
      labCode: pcFormLabCode.trim().toUpperCase(),
      pcCode: pcFormCode.trim().toUpperCase(),
      hostname: pcFormHostname.trim() || `${pcFormLabCode}-${pcFormCode.trim().toUpperCase()}`,
      ipAddress: pcFormIp.trim() || undefined,
      macAddress: pcFormMac.trim() || undefined,
      state: pcFormState,
      hardwareInfo: {
        cpuModel: pcFormCpu,
        ramGb: Number(pcFormRam) || 16,
        diskGb: Number(pcFormDisk) || 512,
        osVersion: 'Microsoft Windows 11 Pro 64-bit'
      }
    };

    let res: any;
    if (pcModalMode === 'CREATE') {
      res = await ApiClient.request('/computers', { method: 'POST', body: JSON.stringify(payload) });
    } else {
      res = await ApiClient.request(`/computers/${editingPcId}`, { method: 'PUT', body: JSON.stringify(payload) });
    }

    setPcFormSubmitting(false);
    if (res.success) {
      setPcModalMode(null);
      await fetchLabsData();
    } else {
      setPcFormError(res.message || res.error || 'Failed to save workstation');
    }
  };

  const handleQuickStateChange = async (pc: any, newState: string) => {
    const res: any = await ApiClient.request(`/computers/${pc.id}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ state: newState, reason: 'Quick Administrator Action' })
    });
    if (res.success) {
      await fetchLabsData();
    } else {
      alert(res.message || res.error || 'State transition rejected');
    }
  };

  const handleUnbindPc = async (pc: any) => {
    if (!window.confirm(`Are you sure you want to unbind client terminal from '${pc.pcCode}'? The terminal will be locked until re-provisioned.`)) {
      return;
    }
    const res: any = await ApiClient.request(`/computers/${pc.id}/unbind`, { method: 'POST' });
    if (res.success) {
      await fetchLabsData();
    } else {
      alert(res.message || res.error || 'Failed to unbind workstation node');
    }
  };

  const handleDeletePc = async (pc: any) => {
    if (!window.confirm(`Are you sure you want to delete workstation '${pc.pcCode}' from laboratory '${pc.labCode}'?`)) {
      return;
    }
    const res: any = await ApiClient.request(`/computers/${pc.id}`, { method: 'DELETE' });
    if (res.success) {
      await LocalDbService.deleteComputer(pc.id, pc.pcCode, pc.labCode);
      await fetchLabsData();
    } else {
      alert(res.message || res.error || 'Failed to delete workstation');
    }
  };

  // ==========================================================================
  // Equipment & Peripheral Accountability Handlers (Phase 8)
  // ==========================================================================
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedLabForEquipment, setSelectedLabForEquipment] = useState<string>('ALL');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<string>('ALL');
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState<string>('ALL');

  // Equipment Create / Edit Modal
  const [equipmentModalMode, setEquipmentModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [eqAssetTag, setEqAssetTag] = useState('');
  const [eqType, setEqType] = useState<string>('KEYBOARD');
  const [eqBrand, setEqBrand] = useState('');
  const [eqModel, setEqModel] = useState('');
  const [eqSerial, setEqSerial] = useState('');
  const [eqStatus, setEqStatus] = useState<string>('FUNCTIONAL');
  const [eqLabCode, setEqLabCode] = useState('');
  const [eqPcCode, setEqPcCode] = useState('');
  const [eqPurchaseDate, setEqPurchaseDate] = useState('2025-01-15');
  const [eqWarranty, setEqWarranty] = useState('2028-01-15');
  const [eqNotes, setEqNotes] = useState('');
  const [eqFormError, setEqFormError] = useState<string | null>(null);
  const [eqFormSubmitting, setEqFormSubmitting] = useState(false);

  // Assign / Reassign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningEquipment, setAssigningEquipment] = useState<any | null>(null);
  const [assignLabCode, setAssignLabCode] = useState('');
  const [assignPcCode, setAssignPcCode] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Replace / Swap Modal
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replacingEquipment, setReplacingEquipment] = useState<any | null>(null);
  const [replacementEquipmentId, setReplacementEquipmentId] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [replaceDefectNotes, setReplaceDefectNotes] = useState('');
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // History Audit Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyEquipment, setHistoryEquipment] = useState<any | null>(null);

  const openCreateEquipmentModal = () => {
    setEquipmentModalMode('CREATE');
    setEditingEquipmentId(null);
    const defaultLab = selectedLabForEquipment !== 'ALL' ? selectedLabForEquipment : (labs[0]?.code || 'LAB-01');
    setEqLabCode(defaultLab);
    setEqPcCode('');
    const nextNum = equipment.length + 1;
    setEqAssetTag(`AST-EQ-${nextNum < 10 ? '0' : ''}${nextNum}`);
    setEqType('KEYBOARD');
    setEqBrand('Dell');
    setEqModel('KB216 Wired Keyboard');
    setEqSerial(`CN-${Math.floor(100000 + Math.random() * 900000)}`);
    setEqStatus('FUNCTIONAL');
    setEqPurchaseDate('2025-01-15');
    setEqWarranty('2028-01-15');
    setEqNotes('');
    setEqFormError(null);
  };

  const openEditEquipmentModal = (item: any) => {
    setEquipmentModalMode('EDIT');
    setEditingEquipmentId(item.id);
    setEqAssetTag(item.assetTag);
    setEqType(item.type);
    setEqBrand(item.brand);
    setEqModel(item.model);
    setEqSerial(item.serialNumber);
    setEqStatus(item.status);
    setEqLabCode(item.labCode || labs[0]?.code || 'LAB-01');
    setEqPcCode(item.pcCode || '');
    setEqPurchaseDate(item.purchaseDate || '2025-01-15');
    setEqWarranty(item.warrantyExpiry || '2028-01-15');
    setEqNotes(item.notes || '');
    setEqFormError(null);
  };

  const handleEquipmentFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqAssetTag.trim() || !eqBrand.trim() || !eqModel.trim() || !eqSerial.trim() || !eqLabCode) {
      setEqFormError('Asset Tag, Type, Brand, Model, Serial Number, and Lab are required');
      return;
    }
    setEqFormSubmitting(true);
    setEqFormError(null);

    const payload = {
      assetTag: eqAssetTag.trim().toUpperCase(),
      type: eqType,
      brand: eqBrand.trim(),
      model: eqModel.trim(),
      serialNumber: eqSerial.trim(),
      status: eqStatus,
      labCode: eqLabCode.trim().toUpperCase(),
      pcCode: eqPcCode.trim() ? eqPcCode.trim().toUpperCase() : undefined,
      purchaseDate: eqPurchaseDate,
      warrantyExpiry: eqWarranty,
      notes: eqNotes.trim()
    };

    let res: any;
    if (equipmentModalMode === 'CREATE') {
      res = await ApiClient.request('/equipment', { method: 'POST', body: JSON.stringify(payload) });
    } else {
      res = await ApiClient.request(`/equipment/${editingEquipmentId}`, { method: 'PUT', body: JSON.stringify(payload) });
    }

    setEqFormSubmitting(false);
    if (res.success) {
      setEquipmentModalMode(null);
      await fetchLabsData();
    } else {
      setEqFormError(res.message || res.error || 'Failed to save equipment');
    }
  };

  const openAssignModal = (item: any) => {
    setAssigningEquipment(item);
    setAssignLabCode(item.labCode || labs[0]?.code || 'LAB-01');
    setAssignPcCode(item.pcCode || '');
    setAssignReason('');
    setAssignError(null);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningEquipment) return;
    setAssignSubmitting(true);
    setAssignError(null);

    const payload = {
      labCode: assignLabCode.trim().toUpperCase(),
      pcCode: assignPcCode.trim() ? assignPcCode.trim().toUpperCase() : undefined,
      unassign: !assignPcCode.trim(),
      reason: assignReason.trim() || (assignPcCode.trim() ? `Assigned to ${assignPcCode.trim()}` : 'Returned to spare pool')
    };

    const res: any = await ApiClient.request(`/equipment/${assigningEquipment.id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    setAssignSubmitting(false);
    if (res.success) {
      setAssignModalOpen(false);
      await fetchLabsData();
    } else {
      setAssignError(res.message || res.error || 'Failed to reassign peripheral');
    }
  };

  const openReplaceModal = (item: any) => {
    setReplacingEquipment(item);
    // Find candidate spares of same type in same lab that are AVAILABLE or FUNCTIONAL without PC
    const spares = equipment.filter((e) => e.id !== item.id && e.type === item.type && !e.pcCode && e.status !== 'FAULTY' && e.status !== 'DECOMMISSIONED');
    setReplacementEquipmentId(spares[0]?.id || '');
    setReplaceReason('Peripheral hardware malfunction replacement');
    setReplaceDefectNotes('');
    setReplaceError(null);
    setReplaceModalOpen(true);
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingEquipment || !replacementEquipmentId) {
      setReplaceError('Please select an available replacement spare from the pool');
      return;
    }
    setReplaceSubmitting(true);
    setReplaceError(null);

    const payload = {
      replacementEquipmentId,
      reason: replaceReason.trim(),
      defectNotes: replaceDefectNotes.trim()
    };

    const res: any = await ApiClient.request(`/equipment/${replacingEquipment.id}/replace`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setReplaceSubmitting(false);
    if (res.success) {
      setReplaceModalOpen(false);
      await fetchLabsData();
    } else {
      setReplaceError(res.message || res.error || 'Failed to execute peripheral replacement');
    }
  };

  const handleDeleteEquipment = async (item: any) => {
    if (!window.confirm(`Are you sure you want to permanently delete equipment '${item.assetTag}' (${item.brand} ${item.model})?`)) {
      return;
    }
    const res: any = await ApiClient.request(`/equipment/${item.id}`, { method: 'DELETE' });
    if (res.success) {
      await LocalDbService.deleteEquipment(item.id);
      await fetchLabsData();
    } else {
      alert(res.message || res.error || 'Failed to delete equipment');
    }
  };

  const openHistoryModal = (item: any) => {
    setHistoryEquipment(item);
    setHistoryModalOpen(true);
  };

  const fetchUsers = async (page = 1, search = searchQuery, role = roleFilter) => {
    setLoadingUsers(true);
    const query = new URLSearchParams();
    query.set('page', page.toString());
    query.set('limit', '10');
    if (search.trim()) query.set('search', search.trim());
    if (role !== 'ALL') query.set('role', role);

    const res: any = await ApiClient.request(`/users?${query.toString()}`);
    if (res.success && res.data) {
      if (Array.isArray(res.data)) {
        setUsers(res.data);
        if (res.pagination) {
          setUserPagination(res.pagination);
        } else {
          setUserPagination({ total: res.data.length, page: 1, limit: 10, totalPages: 1 });
        }
      } else if (res.data.users) {
        setUsers(res.data.users);
        setUserPagination(res.data.pagination);
      }
    }
    setLoadingUsers(false);
  };

  const loadAcademicData = async () => {
    setLoadingAcademic(true);
    const [dRes, cRes, sRes, clRes, yRes, secRes, fRes] = await Promise.all([
      ApiClient.request('/departments'),
      ApiClient.request('/courses'),
      ApiClient.request('/subjects'),
      ApiClient.request('/classes'),
      ApiClient.request('/academic-years'),
      ApiClient.request('/sections'),
      ApiClient.request('/users?role=FACULTY')
    ]);

    if (dRes.success && dRes.data) setDepartments(dRes.data);
    if (cRes.success && cRes.data) setCourses(cRes.data);
    if (sRes.success && sRes.data) setSubjects(sRes.data);
    if (clRes.success && clRes.data) setClasses(clRes.data);
    if (yRes.success && yRes.data) setAcademicYears(yRes.data);
    if (secRes.success && secRes.data) setSections(secRes.data);
    if (fRes.success && fRes.data) {
      const fUsers = Array.isArray(fRes.data) ? fRes.data : (fRes.data.users || []);
      setFacultyList(fUsers);
    }
    setLoadingAcademic(false);
  };

  const fetchEnrollmentRequests = async () => {
    setLoadingRequests(true);
    const res = await ApiClient.request('/enrollment-requests');
    if (res.success && res.data) {
      setEnrollmentRequests(res.data);
      const pending = res.data.filter((r: any) => r.status === 'PENDING').length;
      setPendingRequestsCount(pending);
    }
    setLoadingRequests(false);
  };

  const fetchClassRoster = async (classId: string) => {
    if (!classId) return;
    setLoadingRoster(true);
    const res = await ApiClient.request(`/classes/${classId}/students`);
    if (res.success && res.data) {
      setClassRosterStudents(res.data);
    } else {
      setClassRosterStudents([]);
    }
    setLoadingRoster(false);
  };

  const fetchAllStudents = async (search?: string) => {
    setLoadingAllStudents(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await ApiClient.request(`/students${q}`);
    if (res.success && res.data) {
      setAllStudentsList(res.data);
    }
    setLoadingAllStudents(false);
  };

  const searchStudentsForEnroll = async (query: string) => {
    setStudentSearchQuery(query);
    if (!query.trim()) {
      setStudentSearchResults([]);
      return;
    }
    setSearchingStudents(true);
    const res = await ApiClient.request(`/students?search=${encodeURIComponent(query.trim())}`);
    if (res.success && res.data) {
      setStudentSearchResults(res.data);
    } else {
      setStudentSearchResults([]);
    }
    setSearchingStudents(false);
  };

  const openReviewModal = (req: any, action: 'APPROVE' | 'REJECT') => {
    setReviewingRequest(req);
    setReviewAction(action);
    setReviewNotesInput(action === 'APPROVE' ? 'Approved by Administrator' : 'Rejected by Administrator');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest) return;
    setReviewSubmitting(true);
    const res = await ApiClient.request(`/enrollment-requests/${reviewingRequest.id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: reviewAction,
        reviewNotes: reviewNotesInput.trim() || (reviewAction === 'APPROVE' ? 'Approved by Administrator' : 'Rejected by Administrator')
      })
    });
    setReviewSubmitting(false);
    if (res.success) {
      setReviewModalOpen(false);
      setReviewingRequest(null);
      await fetchEnrollmentRequests();
      await loadAcademicData();
      if (selectedClassForRoster) {
        await fetchClassRoster(selectedClassForRoster);
      }
    } else {
      alert(res.message || res.error || 'Failed to review request');
    }
  };

  const openDirectEnrollModal = (classId?: string) => {
    setEnrollTargetClassId(classId || (classes[0]?.id || ''));
    setStudentSearchQuery('');
    setStudentSearchResults([]);
    setSelectedStudentForEnroll(null);
    setEnrollNotesInput('');
    setEnrollError(null);
    setEnrollSuccess(null);
    setDirectEnrollModalOpen(true);
  };

  const handleDirectEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollTargetClassId) {
      setEnrollError('Please select a target class offering');
      return;
    }
    if (!selectedStudentForEnroll) {
      setEnrollError('Please search and select a student to enroll');
      return;
    }
    setEnrollSubmitting(true);
    setEnrollError(null);
    setEnrollSuccess(null);

    const res = await ApiClient.request(`/classes/${enrollTargetClassId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({
        studentIdentifier: selectedStudentForEnroll.studentId || selectedStudentForEnroll.userId,
        notes: enrollNotesInput.trim() || undefined
      })
    });

    setEnrollSubmitting(false);
    if (res.success) {
      setEnrollSuccess(res.message || `Student successfully enrolled!`);
      setTimeout(() => {
        setDirectEnrollModalOpen(false);
        setSelectedStudentForEnroll(null);
        setStudentSearchQuery('');
        setStudentSearchResults([]);
        setEnrollNotesInput('');
        setEnrollSuccess(null);
      }, 1200);
      await fetchEnrollmentRequests();
      await loadAcademicData();
      if (selectedClassForRoster === enrollTargetClassId) {
        await fetchClassRoster(selectedClassForRoster);
      }
    } else {
      setEnrollError(res.message || res.error || 'Failed to enroll student');
    }
  };

  const handleUnenrollStudent = async (classId: string, studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to unenroll '${studentName}' (${studentId}) from this class?`)) return;
    const res = await ApiClient.request(`/classes/${classId}/students/${studentId}`, {
      method: 'DELETE'
    });
    if (res.success) {
      await fetchClassRoster(classId);
      await loadAcademicData();
    } else {
      alert(res.message || res.error || 'Failed to unenroll student');
    }
  };

  const loadData = async () => {
    setLoading(true);
    const mRes = await ApiClient.request('/analytics');
    if (mRes.success && mRes.data) setMetrics(mRes.data.metrics);

    await fetchUsers(userPagination.page, searchQuery, roleFilter);

    const lRes = await ApiClient.request('/labs');
    if (lRes.success && lRes.data) setLabs(lRes.data);

    const cRes = await ApiClient.request('/computers');
    if (cRes.success && cRes.data) setComputers(cRes.data);

    const aRes = await ApiClient.request('/audit-logs');
    if (aRes.success && aRes.data) setAuditLogs(aRes.data);

    await loadAcademicData();
    await fetchEnrollmentRequests();

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    fetchUsers(1, val, roleFilter);
  };

  const handleRoleFilterChange = (role: 'ALL' | 'STUDENT' | 'FACULTY' | 'LAB_ASSISTANT' | 'ADMIN') => {
    setRoleFilter(role);
    fetchUsers(1, searchQuery, role);
  };

  const handleOpenCreateUser = () => {
    setFormError(null);
    setEditingUserId(null);
    setFormRole('STUDENT');
    setFormFullName('');
    setFormDateOfBirth('');
    setFormGender('');
    setFormEmail('');
    setFormPhone('');
    setFormIdentifier('');
    setFormPassword('User@123');
    setFormDepartment('Computer Science');
    setFormCourse('B.Tech');
    setFormYearOfStudy(1);
    setFormSemester(1);
    setFormSection('A');
    setFormAcademicYear('2025-2026');
    setFormAssignedLabs([]);
    setUserModalMode('CREATE');
  };

  const handleOpenEditUser = (user: any) => {
    setFormError(null);
    setEditingUserId(user.id);
    setFormRole(user.role || 'STUDENT');
    setFormFullName(user.fullName || '');
    setFormDateOfBirth(user.dateOfBirth || '');
    setFormGender(user.gender || '');
    setFormEmail(user.email || '');
    setFormPhone(user.phone || '');
    setFormIdentifier(user.identifier || '');
    setFormPassword('');

    const student = user.studentProfile || {};
    setFormDepartment(user.department || student.department || 'Computer Science');
    setFormCourse(student.course || '');
    setFormYearOfStudy(student.yearOfStudy || '');
    setFormSemester(student.semester || '');
    setFormSection(student.section || '');
    setFormAcademicYear(student.academicYear || '');
    setFormAssignedLabs(user.assignedLabs || []);
    setUserModalMode('EDIT');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    const payload: any = {
      fullName: formFullName,
      email: formEmail,
      role: formRole,
      identifier: formIdentifier || formEmail,
      dateOfBirth: formDateOfBirth || undefined,
      gender: formGender || undefined,
      phone: formPhone || undefined,
      department: formDepartment || undefined,
      course: formCourse || undefined,
      yearOfStudy: formYearOfStudy !== '' ? Number(formYearOfStudy) : undefined,
      semester: formSemester !== '' ? Number(formSemester) : undefined,
      section: formSection || undefined,
      academicYear: formAcademicYear || undefined,
      assignedLabs: formAssignedLabs
    };

    if (userModalMode === 'CREATE') {
      payload.password = formPassword || 'User@123';
      const res = await ApiClient.request('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        setUserModalMode(null);
        fetchUsers(userPagination.page);
        loadData();
      } else {
        setFormError(res.error || 'Failed to create user account');
      }
    } else if (userModalMode === 'EDIT' && editingUserId) {
      if (formPassword) {
        payload.password = formPassword;
      }
      const res = await ApiClient.request(`/users/${editingUserId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        setUserModalMode(null);
        fetchUsers(userPagination.page);
        loadData();
      } else {
        setFormError(res.error || 'Failed to update user account');
      }
    }
    setFormSubmitting(false);
  };

  const handleToggleStatus = async (user: any) => {
    const nextStatus = !user.isActive;
    const res = await ApiClient.request(`/users/${user.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: nextStatus })
    });
    if (res.success) {
      fetchUsers(userPagination.page);
    } else {
      alert(res.error || 'Cannot modify root administrator or user status');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setFormSubmitting(true);
    const res: any = await ApiClient.request(`/users/${deletingUser.id}`, {
      method: 'DELETE'
    });
    setFormSubmitting(false);
    if (res.success) {
      await LocalDbService.deleteUser(deletingUser.id, deletingUser.email);
      setDeletingUser(null);
      fetchUsers(userPagination.page);
      loadData();
    } else {
      alert(res.error || res.message || 'Failed to delete user account');
    }
  };

  const toggleLabAssignment = (labIdentifier: string) => {
    setFormAssignedLabs((prev) =>
      prev.includes(labIdentifier)
        ? prev.filter((code) => code !== labIdentifier)
        : [...prev, labIdentifier]
    );
  };

  const handleOpenAcademicModal = (
    type: 'DEPT' | 'COURSE' | 'SUBJECT' | 'CLASS' | 'YEAR' | 'SECTION',
    mode: 'CREATE' | 'EDIT' = 'CREATE',
    item?: any
  ) => {
    setAcademicFormError(null);
    setAcademicModal(type);
    setAcademicModalMode(mode);
    setEditingAcademicId(item ? item.id : null);

    if (type === 'DEPT') {
      setDeptCode(item?.code || '');
      setDeptName(item?.name || '');
      setDeptDesc(item?.description || '');
    } else if (type === 'COURSE') {
      setCourseCode(item?.code || '');
      setCourseName(item?.name || '');
      setCourseDeptId(item?.departmentId || (departments[0]?.id || ''));
      setCourseDegreeLevel(item?.degreeLevel || 'Undergraduate');
    } else if (type === 'SUBJECT') {
      setSubjectCode(item?.code || '');
      setSubjectName(item?.name || '');
      setSubjectDeptId(item?.departmentId || (departments[0]?.id || ''));
      setSubjectSemester(item?.semester || 1);
      setSubjectCredits(item?.credits || 2);
    } else if (type === 'YEAR') {
      setYearString(item?.year || '');
      setYearIsCurrent(item ? Boolean(item.isCurrent) : false);
      setYearStart(item?.startDate || '');
      setYearEnd(item?.endDate || '');
    } else if (type === 'SECTION') {
      setSectionName(item?.name || '');
    } else if (type === 'CLASS') {
      setClassName(item?.name || '');
      setClassCourseId(item?.courseId || (courses[0]?.id || ''));
      setClassSubjectId(item?.subjectId || (subjects[0]?.id || ''));
      setClassYear(item?.academicYear || (academicYears.find((y) => y.isCurrent)?.year || '2025-2026'));
      setClassSemester(item?.semester || 1);
      setClassSection(item?.section || (sections[0]?.name || 'A'));
      setClassFacultyId(item?.assignedFacultyId || '');
      setClassLabCode(item?.defaultLabCode || (labs[0]?.code || ''));
      setClassEnrollmentPolicy(item?.enrollmentPolicy || 'DIRECT');
      setClassCapacity(item?.capacity || 40);
    }
  };

  const handleDeleteAcademic = async (
    type: 'departments' | 'courses' | 'subjects' | 'academic-years' | 'sections' | 'classes',
    id: string,
    label: string
  ) => {
    if (!confirm(`Are you sure you want to delete ${label}?`)) return;
    const res = await ApiClient.request(`/${type}/${id}`, { method: 'DELETE' });
    if (res.success) {
      loadAcademicData();
    } else {
      alert(res.message || res.error || `Failed to delete ${label}`);
    }
  };

  const handleSaveAcademic = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcademicFormError(null);
    setAcademicSubmitting(true);

    let endpoint = '';
    let body: any = {};

    if (academicModal === 'DEPT') {
      endpoint = academicModalMode === 'CREATE' ? '/departments' : `/departments/${editingAcademicId}`;
      body = { code: deptCode, name: deptName, description: deptDesc };
    } else if (academicModal === 'COURSE') {
      endpoint = academicModalMode === 'CREATE' ? '/courses' : `/courses/${editingAcademicId}`;
      body = { code: courseCode, name: courseName, departmentId: courseDeptId, degreeLevel: courseDegreeLevel };
    } else if (academicModal === 'SUBJECT') {
      endpoint = academicModalMode === 'CREATE' ? '/subjects' : `/subjects/${editingAcademicId}`;
      body = {
        code: subjectCode,
        name: subjectName,
        departmentId: subjectDeptId,
        semester: Number(subjectSemester),
        credits: Number(subjectCredits)
      };
    } else if (academicModal === 'YEAR') {
      endpoint = academicModalMode === 'CREATE' ? '/academic-years' : `/academic-years/${editingAcademicId}`;
      body = { year: yearString, isCurrent: yearIsCurrent, startDate: yearStart, endDate: yearEnd };
    } else if (academicModal === 'SECTION') {
      endpoint = '/sections';
      body = { name: sectionName };
    } else if (academicModal === 'CLASS') {
      endpoint = academicModalMode === 'CREATE' ? '/classes' : `/classes/${editingAcademicId}`;
      body = {
        name: className,
        courseId: classCourseId,
        subjectId: classSubjectId,
        academicYear: classYear,
        semester: Number(classSemester),
        section: classSection,
        assignedFacultyId: classFacultyId || undefined,
        defaultLabCode: classLabCode || undefined,
        enrollmentPolicy: classEnrollmentPolicy,
        capacity: Number(classCapacity)
      };
    }

    const method = academicModalMode === 'CREATE' ? 'POST' : 'PUT';
    const res = await ApiClient.request(endpoint, {
      method,
      body: JSON.stringify(body)
    });

    if (res.success) {
      setAcademicModal(null);
      loadAcademicData();
    } else {
      setAcademicFormError(res.message || res.error || 'Failed to save academic entity');
    }
    setAcademicSubmitting(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-full w-full min-h-0">
      {/* Tab Navigation Strip */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-2.5 flex space-x-1 overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
          { id: 'people', label: 'People (Users)', icon: Users },
          { id: 'labs', label: 'Labs & Computers', icon: Building2 },
          { id: 'academic', label: 'Academic Setup', icon: BookOpen },
          { id: 'enrollment', label: 'Student Enrollment & Requests', icon: GraduationCap, badge: pendingRequestsCount },
          { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
          { id: 'settings', label: 'Workstation Settings', icon: Settings },
        ].map((tab: any) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === 'enrollment') {
                  fetchEnrollmentRequests();
                  fetchAllStudents();
                }
              }}
              className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer relative shrink-0 ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-white rounded-full ml-1 animate-pulse">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 bg-slate-50">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Institutional Lab Metrics</h2>
                <p className="text-xs text-slate-500">Live indicators aggregated from central database (Zero Mock Data)</p>
              </div>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Laboratories</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalLabs}</p>
                <span className="text-[11px] text-slate-500">Managed Facilities</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Computers</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalComputers}</p>
                <span className="text-[11px] text-slate-500">Workstation Nodes</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Students</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalStudents}</p>
                <span className="text-[11px] text-slate-500">Enrolled Profiles</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Active Sessions</span>
                <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.activeSessions}</p>
                <span className="text-[11px] text-slate-500">Occupied PCs</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Open Issues</span>
                <p className="text-2xl font-bold text-rose-600 mt-1">{metrics.openIssues}</p>
                <span className="text-[11px] text-slate-500">Pending Attention</span>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Native Windows System Architecture</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                LABGUARD operates with local SQLite persistence and automatic synchronization to the central Express API.
                Hardware peripheral changes are monitored via Windows APIs without polling overhead, ensuring zero disruption to students.
              </p>
            </div>
          </div>
        )}

        {/* PEOPLE TAB */}
        {activeTab === 'people' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Header & Primary Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Institutional People Management</h2>
                <p className="text-xs text-slate-500">
                  Manage user profiles, assign laboratory access, configure academic affiliations, and toggle account states.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fetchUsers(userPagination.page, searchQuery, roleFilter)}
                  disabled={loadingUsers}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  title="Refresh users list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleOpenCreateUser}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Provision User</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name, roll no, email, dept..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Role filter chips */}
              <div className="flex items-center space-x-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {(['ALL', 'STUDENT', 'FACULTY', 'LAB_ASSISTANT', 'ADMIN'] as const).map((r) => {
                  const isSelected = roleFilter === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleRoleFilterChange(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>

              {/* Counter badge */}
              <div className="text-xs text-slate-500 font-medium whitespace-nowrap self-end md:self-center">
                Total: <span className="font-bold text-slate-800">{userPagination.total}</span> users
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Identity & Roll No</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Department & Academic</th>
                      <th className="px-4 py-3">Assigned Labs</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                          <span>Loading users directory...</span>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">No users found</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {searchQuery || roleFilter !== 'ALL'
                              ? 'Try refining your search keyword or role filter'
                              : 'Click "Provision User" to register the first account'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const student = u.studentProfile;
                        const roleColor =
                          u.role === 'ADMIN'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : u.role === 'FACULTY'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : u.role === 'LAB_ASSISTANT'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200';

                        return (
                          <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.isActive ? 'opacity-60 bg-slate-50/50' : ''}`}>
                            {/* Identity */}
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{u.fullName}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {u.identifier || u.id.slice(0, 8)}
                              </div>
                            </td>

                            {/* Role */}
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleColor}`}>
                                {u.role}
                              </span>
                            </td>

                            {/* Contact */}
                            <td className="px-4 py-3">
                              <div className="text-slate-800">{u.email}</div>
                              <div className="text-[11px] text-slate-400">{u.phone || 'No phone'}</div>
                            </td>

                            {/* Department / Academic */}
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{u.department || 'General'}</div>
                              {student ? (
                                <div className="text-[11px] text-slate-500">
                                  {student.course ? `${student.course} • ` : ''}
                                  {student.yearOfStudy ? `Yr ${student.yearOfStudy} ` : ''}
                                  {student.semester ? `Sem ${student.semester}` : ''}
                                  {student.section ? ` (${student.section})` : ''}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400">Institutional Staff</div>
                              )}
                            </td>

                            {/* Assigned Labs */}
                            <td className="px-4 py-3">
                              {u.assignedLabs && u.assignedLabs.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[180px]">
                                  {u.assignedLabs.map((lCode: string) => (
                                    <span
                                      key={lCode}
                                      className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700"
                                    >
                                      {lCode}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">All / None</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              {u.isActive ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  <span>Disabled</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit user details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    u.isActive
                                      ? 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                                      : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={u.isActive ? 'Deactivate account' : 'Activate account'}
                                >
                                  {u.isActive ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => setDeletingUser(u)}
                                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Permanently delete user account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Showing{' '}
                  <span className="font-semibold text-slate-800">
                    {userPagination.total === 0
                      ? 0
                      : (userPagination.page - 1) * userPagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-slate-800">
                    {Math.min(userPagination.page * userPagination.limit, userPagination.total)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-800">{userPagination.total}</span> users
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchUsers(userPagination.page - 1)}
                    disabled={userPagination.page <= 1}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <span className="text-xs font-semibold text-slate-600 px-2">
                    Page {userPagination.page} of {userPagination.totalPages || 1}
                  </span>
                  <button
                    onClick={() => fetchUsers(userPagination.page + 1)}
                    disabled={userPagination.page >= userPagination.totalPages}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Enterprise 2-Column User Provisioning / Edit Modal */}
            {userModalMode && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {userModalMode === 'CREATE'
                          ? 'Provision Institutional Account'
                          : 'Edit Institutional Profile'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {userModalMode === 'CREATE'
                          ? 'Create a new credential with role permissions and laboratory authorizations.'
                          : 'Modify identity attributes, academic affiliation, and lab permissions.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setUserModalMode(null)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Error Alert */}
                  {formError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* 2-Column Form */}
                  <form onSubmit={handleSaveUser} className="mt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Column 1: Identity & Credentials */}
                      <div className="space-y-3.5">
                        <div className="flex items-center space-x-1.5 pb-2 border-b border-slate-100">
                          <Shield className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Identity & Credentials
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Institutional Role *
                          </label>
                          <select
                            value={formRole}
                            onChange={(e) => setFormRole(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="STUDENT">STUDENT (Workstation Client Access)</option>
                            <option value="FACULTY">FACULTY (Lab Scheduling & Oversight)</option>
                            <option value="LAB_ASSISTANT">LAB_ASSISTANT (Hardware & Maintenance)</option>
                            <option value="ADMIN">ADMIN (Full Institutional Authority)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Full Legal Name *
                          </label>
                          <input
                            type="text"
                            value={formFullName}
                            onChange={(e) => setFormFullName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20"
                            placeholder="e.g. Dr. Rajesh Sharma"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Identifier / Roll No *
                            </label>
                            <input
                              type="text"
                              value={formIdentifier}
                              onChange={(e) => setFormIdentifier(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 font-mono focus:ring-2 focus:ring-blue-500/20"
                              placeholder="STU-2025-001"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Gender
                            </label>
                            <select
                              value={formGender}
                              onChange={(e) => setFormGender(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white"
                            >
                              <option value="">Unspecified</option>
                              <option value="MALE">Male</option>
                              <option value="FEMALE">Female</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            value={formEmail}
                            onChange={(e) => setFormEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20"
                            placeholder="username@institution.edu"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              value={formPhone}
                              onChange={(e) => setFormPhone(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20"
                              placeholder="+91 98765 43210"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Date of Birth
                            </label>
                            <input
                              type="date"
                              value={formDateOfBirth}
                              onChange={(e) => setFormDateOfBirth(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            {userModalMode === 'CREATE' ? 'Initial Password *' : 'Change Password (Optional)'}
                          </label>
                          <div className="relative">
                            <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="password"
                              value={formPassword}
                              onChange={(e) => setFormPassword(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20"
                              placeholder={
                                userModalMode === 'CREATE' ? 'Default: User@123' : 'Leave empty to keep current password'
                              }
                              required={userModalMode === 'CREATE'}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Academic & Laboratory Assignment */}
                      <div className="space-y-3.5">
                        <div className="flex items-center space-x-1.5 pb-2 border-b border-slate-100">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Academic & Lab Assignment
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Department
                          </label>
                          <input
                            type="text"
                            value={formDepartment}
                            onChange={(e) => setFormDepartment(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20"
                            placeholder="e.g. Computer Science & Engineering"
                          />
                        </div>

                        {/* Student-specific Academic Details */}
                        {formRole === 'STUDENT' && (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Student Academic Profile
                            </span>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                Course / Program
                              </label>
                              <input
                                type="text"
                                value={formCourse}
                                onChange={(e) => setFormCourse(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400"
                                placeholder="e.g. B.Tech Computer Science"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                  Year of Study
                                </label>
                                <select
                                  value={formYearOfStudy}
                                  onChange={(e) => setFormYearOfStudy(e.target.value ? Number(e.target.value) : '')}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                                >
                                  <option value="">Select Year</option>
                                  <option value="1">1st Year</option>
                                  <option value="2">2nd Year</option>
                                  <option value="3">3rd Year</option>
                                  <option value="4">4th Year</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                  Semester
                                </label>
                                <select
                                  value={formSemester}
                                  onChange={(e) => setFormSemester(e.target.value ? Number(e.target.value) : '')}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                                >
                                  <option value="">Select Sem</option>
                                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                    <option key={s} value={s}>Semester {s}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                  Section
                                </label>
                                <input
                                  type="text"
                                  value={formSection}
                                  onChange={(e) => setFormSection(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400"
                                  placeholder="e.g. A"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                  Academic Year
                                </label>
                                <input
                                  type="text"
                                  value={formAcademicYear}
                                  onChange={(e) => setFormAcademicYear(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400"
                                  placeholder="2025-2026"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Laboratory Authorization Checkboxes */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase">
                              Assigned Laboratories
                            </label>
                            <span className="text-[10px] text-slate-400">
                              {formAssignedLabs.length} selected
                            </span>
                          </div>

                          <div className="border border-slate-200 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1.5 bg-slate-50">
                            {labs.length === 0 ? (
                              <p className="text-[11px] text-slate-400 text-center py-3">
                                No laboratories registered yet.
                              </p>
                            ) : (
                              labs.map((lab) => {
                                const isChecked =
                                  formAssignedLabs.includes(lab.code) ||
                                  formAssignedLabs.includes(lab.id);
                                return (
                                  <label
                                    key={lab.id}
                                    className="flex items-center space-x-2.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors text-xs"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleLabAssignment(lab.code || lab.id)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-slate-800 truncate">
                                        {lab.name}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {lab.code} • {lab.room} ({lab.building})
                                      </div>
                                    </div>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setUserModalMode(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={formSubmitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                      >
                        {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>
                          {userModalMode === 'CREATE'
                            ? formSubmitting
                              ? 'Provisioning...'
                              : 'Provision User'
                            : formSubmitting
                            ? 'Saving Changes...'
                            : 'Save Changes'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete User Confirmation Modal */}
            {deletingUser && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                  <div className="flex items-center space-x-3 text-rose-600 pb-2 border-b border-slate-100">
                    <div className="p-2.5 bg-rose-50 rounded-xl">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Delete User Account</h3>
                      <p className="text-xs text-slate-500">Permanent institutional account removal</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Are you sure you want to permanently delete the account for{' '}
                    <strong className="text-slate-900 font-semibold">{deletingUser.fullName}</strong>{' '}
                    ({deletingUser.identifier || deletingUser.email})?
                  </p>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Role:</span>
                      <span className="font-semibold text-slate-800">{deletingUser.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-mono text-slate-800">{deletingUser.email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Identifier / Roll:</span>
                      <span className="font-mono text-slate-800">{deletingUser.identifier || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2 text-[11px] text-amber-800 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>This action cannot be undone. Associated student profiles will be removed.</span>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDeletingUser(null)}
                      disabled={formSubmitting}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteUser}
                      disabled={formSubmitting}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                    >
                      {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{formSubmitting ? 'Deleting...' : 'Permanently Delete'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LABS & FLEET MANAGEMENT TAB (Phase 6) */}
        {activeTab === 'labs' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Laboratories & Fleet Workstation Management</h2>
                    <p className="text-xs text-slate-500">
                      Institutional campus facilities, computing clusters, workstation health, and faculty/assistant personnel assignments.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchLabsData()}
                  disabled={loadingLabs}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLabs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={openCreateLabModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Laboratory
                </button>
              </div>
            </div>

            {/* Hero Metric Summary Cards */}
            {(() => {
              const totalLabsCount = labs.length;
              const totalCampusCapacity = labs.reduce((acc, l) => acc + (Number(l.capacity) || 0), 0);
              const totalFleetWorkstations = labs.reduce((acc, l) => acc + (l.metrics?.totalPcs ?? (Number(l.pcCount) || 0)), 0);
              const availableWorkstations = labs.reduce((acc, l) => acc + (l.metrics?.availablePcs || 0), 0);
              const occupiedWorkstations = labs.reduce((acc, l) => acc + (l.metrics?.occupiedPcs || 0), 0);
              const maintenanceWorkstations = labs.reduce((acc, l) => acc + (l.metrics?.maintenancePcs || 0) + (l.metrics?.offlinePcs || 0), 0);
              const availPct = totalFleetWorkstations > 0 ? Math.round((availableWorkstations / totalFleetWorkstations) * 100) : 0;

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Facilities</span>
                      <Building2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">{totalLabsCount}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Active Campus Labs</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Total Seats</span>
                      <Users className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">{totalCampusCapacity}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Seating Capacity</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Total Fleet</span>
                      <Monitor className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">{totalFleetWorkstations}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Workstations Bound</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Available</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-xl font-bold text-emerald-600">{availableWorkstations}</div>
                    <div className="text-[10px] text-emerald-600 font-medium mt-0.5">{availPct}% Ready to Deploy</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Active In-Use</span>
                      <Laptop className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-xl font-bold text-blue-600">{occupiedWorkstations}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Active Student Sessions</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Maint / Offline</span>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-xl font-bold text-amber-600">{maintenanceWorkstations}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Needs Attention</div>
                  </div>
                </div>
              );
            })()}

            {/* Controls Bar & Subview Switcher */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Subview pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setLabSubView('facilities')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    labSubView === 'facilities'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Laboratories</span>
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    labSubView === 'facilities' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {labs.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLabSubView('workstations')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    labSubView === 'workstations'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Workstations Fleet</span>
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    labSubView === 'workstations' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {computers.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLabSubView('equipment')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    labSubView === 'equipment'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Peripherals & Assets</span>
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    labSubView === 'equipment' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {equipment.length}
                  </span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative flex-1 md:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={labSearch}
                    onChange={(e) => {
                      setLabSearch(e.target.value);
                      if (labSubView === 'facilities') {
                        fetchLabsData(e.target.value, labStatusFilter);
                      }
                    }}
                    placeholder="Search by code, name, room..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                  {labSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setLabSearch('');
                        fetchLabsData('', labStatusFilter);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Status Filter (Facilities) */}
                {labSubView === 'facilities' && (
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={labStatusFilter}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setLabStatusFilter(val);
                        fetchLabsData(labSearch, val);
                      }}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">Active / Operational</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="INACTIVE">Inactive / Offline</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* SUBVIEW 1: LABORATORIES DIRECTORY */}
            {labSubView === 'facilities' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                {loadingLabs ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-xs font-medium">Synchronizing laboratory registry...</span>
                  </div>
                ) : labs.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <h3 className="text-sm font-bold text-slate-700">No Laboratories Found</h3>
                    <p className="text-xs text-slate-500 mt-1">No facilities match your search criteria or none have been provisioned.</p>
                    <button
                      type="button"
                      onClick={openCreateLabModal}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Provision New Laboratory
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px] tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Facility & Code</th>
                          <th className="px-4 py-3">Building & Room</th>
                          <th className="px-4 py-3">Capacity & PCs</th>
                          <th className="px-4 py-3">Fleet Rollup</th>
                          <th className="px-4 py-3">Supervisory Staff</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {labs.map((l) => {
                          const m = l.metrics || {
                            totalPcs: l.pcCount || 0,
                            availablePcs: 0,
                            occupiedPcs: 0,
                            maintenancePcs: 0,
                            disabledPcs: 0,
                            offlinePcs: 0
                          };
                          const staff = l.assignedStaff || [];
                          const facultyStaff = staff.filter((s: any) => s.role === 'FACULTY');
                          const assistantStaff = staff.filter((s: any) => s.role === 'LAB_ASSISTANT');

                          return (
                            <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Facility & Code */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-start gap-2.5">
                                  <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded text-[11px] tracking-wide shrink-0">
                                    {l.code}
                                  </span>
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm leading-tight">{l.name}</div>
                                    {l.description && (
                                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{l.description}</div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Building & Room */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5 text-slate-700">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <div>
                                    <div className="font-medium text-slate-900">{l.room}</div>
                                    <div className="text-[11px] text-slate-500">{l.building || 'Main Campus'}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Capacity & PCs */}
                              <td className="px-4 py-3.5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <span className="font-semibold">{m.totalPcs} PCs</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-slate-500">{l.capacity} Seats</span>
                                  </div>
                                  <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-1.5 rounded-full"
                                      style={{ width: `${Math.min(100, l.capacity > 0 ? (m.totalPcs / l.capacity) * 100 : 0)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Fleet Rollup */}
                              <td className="px-4 py-3.5">
                                <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200" title="Available">
                                    Avail: {m.availablePcs}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200" title="In-Use">
                                    In Use: {m.occupiedPcs}
                                  </span>
                                  {m.maintenancePcs > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Maintenance">
                                      Maint: {m.maintenancePcs}
                                    </span>
                                  )}
                                  {m.offlinePcs > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200" title="Offline">
                                      Off: {m.offlinePcs}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Supervisory Staff */}
                              <td className="px-4 py-3.5">
                                {staff.length === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => openStaffModal(l)}
                                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    Assign Personnel
                                  </button>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-1">
                                      {facultyStaff.map((f: any) => (
                                        <span
                                          key={f.id}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100"
                                          title={`Faculty: ${f.fullName} (${f.email})`}
                                        >
                                          <GraduationCap className="w-2.5 h-2.5" />
                                          {f.fullName}
                                        </span>
                                      ))}
                                      {assistantStaff.map((a: any) => (
                                        <span
                                          key={a.id}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100"
                                          title={`Lab Assistant: ${a.fullName} (${a.email})`}
                                        >
                                          <Shield className="w-2.5 h-2.5" />
                                          {a.fullName}
                                        </span>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openStaffModal(l)}
                                      className="text-[10px] text-slate-500 hover:text-blue-600 hover:underline"
                                    >
                                      Edit Staff ({staff.length})
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Facility Status */}
                              <td className="px-4 py-3.5">
                                {l.status === 'ACTIVE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Operational
                                  </span>
                                ) : l.status === 'MAINTENANCE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Maintenance
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Decommissioned
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openStaffModal(l)}
                                    title="Assign Staff"
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  >
                                    <Users className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditLabModal(l)}
                                    title="Edit Facility"
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLab(l)}
                                    title="Delete Facility"
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SUBVIEW 2: WORKSTATIONS FLEET EXPLORER */}
            {labSubView === 'workstations' && (
              <div className="space-y-4">
                {/* Secondary Workstation Filters & Action Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">Filter by Lab:</span>
                      <select
                        value={selectedLabForWorkstations}
                        onChange={(e) => setSelectedLabForWorkstations(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="ALL">All Laboratories ({computers.length} Workstations)</option>
                        {labs.map((l) => (
                          <option key={l.id} value={l.code}>
                            {l.code} - {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-600 mr-1">State:</span>
                      {['ALL', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DISABLED', 'OFFLINE'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setPcStateFilter(st)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                            pcStateFilter === st
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openCreatePcModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Register Workstation
                  </button>
                </div>

                {/* Workstations Table */}
                {(() => {
                  let filteredPcs = computers;
                  if (selectedLabForWorkstations !== 'ALL') {
                    filteredPcs = filteredPcs.filter((c) => c.labCode === selectedLabForWorkstations);
                  }
                  if (pcStateFilter !== 'ALL') {
                    filteredPcs = filteredPcs.filter((c) => c.state === pcStateFilter);
                  }
                  if (labSearch.trim()) {
                    const q = labSearch.toLowerCase();
                    filteredPcs = filteredPcs.filter((c) =>
                      c.pcCode.toLowerCase().includes(q) ||
                      (c.hostname && c.hostname.toLowerCase().includes(q)) ||
                      (c.ipAddress && c.ipAddress.toLowerCase().includes(q)) ||
                      (c.labCode && c.labCode.toLowerCase().includes(q))
                    );
                  }

                  return (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      {filteredPcs.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                          <Monitor className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <h3 className="text-sm font-bold text-slate-700">No Workstations Found</h3>
                          <p className="text-xs text-slate-500 mt-1">No client workstations match the selected filters.</p>
                          <button
                            type="button"
                            onClick={openCreatePcModal}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Register Workstation Node
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px] tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Workstation & Specs</th>
                                <th className="px-4 py-3">Assigned Lab</th>
                                <th className="px-4 py-3">Hostname & Network</th>
                                <th className="px-4 py-3">Peripherals</th>
                                <th className="px-4 py-3">Operational State</th>
                                <th className="px-4 py-3">Quick Transition</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredPcs.map((c) => {
                                const periph = c.peripherals || { keyboard: true, mouse: true, display: true };
                                return (
                                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                                    {/* Workstation & Specs */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-start gap-2">
                                        <Monitor className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                        <div>
                                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                            {c.pcCode}
                                            {c.clientId && (
                                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-mono tracking-tight font-medium" title={`Client ID: ${c.clientId}`}>
                                                BOUND
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Cpu className="w-3 h-3 text-slate-400" />
                                            <span>{c.hardwareInfo?.cpuModel ? c.hardwareInfo.cpuModel.split(' / ')[0] : 'Intel Core i7'}</span>
                                            <span className="text-slate-300">•</span>
                                            <span>{c.hardwareInfo?.ramGb || 16}GB RAM</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Assigned Lab */}
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 font-bold rounded text-[11px]">
                                        {c.labCode}
                                      </span>
                                    </td>

                                    {/* Hostname & Network */}
                                    <td className="px-4 py-3">
                                      <div className="font-medium text-slate-800">{c.hostname || 'Unspecified Host'}</div>
                                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <span>{c.ipAddress || 'DHCP Dynamic'}</span>
                                        {c.isOnline ? (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                                            <Wifi className="w-2.5 h-2.5" />
                                            Online
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                                            <WifiOff className="w-2.5 h-2.5" />
                                            Offline
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Peripherals Health */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-[10px]" title={`Keyboard: ${periph.keyboard ? 'Connected' : 'Missing/Disconnected'}`}>
                                          <span className={`w-2 h-2 rounded-full ${periph.keyboard ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                          <span className="text-slate-600 font-medium">KB</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px]" title={`Mouse: ${periph.mouse ? 'Connected' : 'Missing/Disconnected'}`}>
                                          <span className={`w-2 h-2 rounded-full ${periph.mouse ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                          <span className="text-slate-600 font-medium">MS</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px]" title={`Display: ${periph.display ? 'Connected' : 'Missing/Disconnected'}`}>
                                          <span className={`w-2 h-2 rounded-full ${periph.display ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                          <span className="text-slate-600 font-medium">DSP</span>
                                        </span>
                                      </div>
                                    </td>

                                    {/* Operational State & Active Session */}
                                    <td className="px-4 py-3">
                                      <div className="space-y-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                          c.state === 'AVAILABLE'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : c.state === 'IN_USE'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : c.state === 'MAINTENANCE'
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : c.state === 'DISABLED'
                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${
                                            c.state === 'AVAILABLE'
                                              ? 'bg-emerald-500'
                                              : c.state === 'IN_USE'
                                              ? 'bg-blue-500'
                                              : c.state === 'MAINTENANCE'
                                              ? 'bg-amber-500'
                                              : c.state === 'DISABLED'
                                              ? 'bg-rose-500'
                                              : 'bg-slate-400'
                                          }`} />
                                          {c.state}
                                        </span>
                                        {c.state === 'IN_USE' && (
                                          <div className="text-[10px] text-blue-700 font-medium flex items-center gap-1">
                                            <Laptop className="w-2.5 h-2.5" />
                                            <span>{c.activeStudentName || 'Active Session'}</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    {/* Quick State Transition */}
                                    <td className="px-4 py-3">
                                      <select
                                        value={c.state}
                                        onChange={(e) => handleQuickStateChange(c, e.target.value)}
                                        className="text-[11px] bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-semibold focus:outline-hidden focus:border-blue-500 cursor-pointer"
                                      >
                                        <option value="AVAILABLE">AVAILABLE</option>
                                        <option value="IN_USE">IN_USE</option>
                                        <option value="MAINTENANCE">MAINTENANCE</option>
                                        <option value="DISABLED">DISABLED</option>
                                        <option value="OFFLINE">OFFLINE</option>
                                      </select>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        {c.clientId && (
                                          <button
                                            type="button"
                                            onClick={() => handleUnbindPc(c)}
                                            title="Unbind Client Terminal"
                                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                                          >
                                            <Unlink className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => openEditPcModal(c)}
                                          title="Edit Workstation"
                                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeletePc(c)}
                                          title="Delete Workstation"
                                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUBVIEW 3: PERIPHERAL EQUIPMENT & ASSETS INVENTORY (Phase 8) */}
            {labSubView === 'equipment' && (
              <div className="space-y-4">
                {/* Equipment Filter & Actions Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Lab filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">Lab:</span>
                      <select
                        value={selectedLabForEquipment}
                        onChange={(e) => setSelectedLabForEquipment(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="ALL">All Facilities ({equipment.length} Assets)</option>
                        {labs.map((l) => (
                          <option key={l.id} value={l.code}>
                            {l.code} - {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Type filter */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs font-semibold text-slate-600 mr-1">Type:</span>
                      {['ALL', 'KEYBOARD', 'MOUSE', 'MONITOR', 'HEADSET', 'UPS', 'OTHER'].map((tp) => (
                        <button
                          key={tp}
                          type="button"
                          onClick={() => setEquipmentTypeFilter(tp)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            equipmentTypeFilter === tp
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {tp}
                        </button>
                      ))}
                    </div>

                    {/* Status filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">Status:</span>
                      <select
                        value={equipmentStatusFilter}
                        onChange={(e) => setEquipmentStatusFilter(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="FUNCTIONAL">FUNCTIONAL (Assigned)</option>
                        <option value="AVAILABLE">AVAILABLE (In Pool)</option>
                        <option value="FAULTY">FAULTY (Needs Repair)</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openCreateEquipmentModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Register Peripheral
                  </button>
                </div>

                {/* Equipment Inventory Table */}
                {(() => {
                  let filteredEq = equipment;
                  if (selectedLabForEquipment !== 'ALL') {
                    filteredEq = filteredEq.filter((e) => e.labCode === selectedLabForEquipment);
                  }
                  if (equipmentTypeFilter !== 'ALL') {
                    filteredEq = filteredEq.filter((e) => e.type === equipmentTypeFilter);
                  }
                  if (equipmentStatusFilter !== 'ALL') {
                    filteredEq = filteredEq.filter((e) => e.status === equipmentStatusFilter);
                  }
                  if (labSearch.trim()) {
                    const q = labSearch.toLowerCase();
                    filteredEq = filteredEq.filter(
                      (e) =>
                        e.assetTag.toLowerCase().includes(q) ||
                        e.brand.toLowerCase().includes(q) ||
                        e.model.toLowerCase().includes(q) ||
                        e.serialNumber.toLowerCase().includes(q) ||
                        (e.pcCode && e.pcCode.toLowerCase().includes(q))
                    );
                  }

                  return (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      {filteredEq.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                          <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <h3 className="text-sm font-bold text-slate-700">No Equipment Assets Found</h3>
                          <p className="text-xs text-slate-500 mt-1">No peripherals match the selected filters.</p>
                          <button
                            type="button"
                            onClick={openCreateEquipmentModal}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Register Peripheral Asset
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px] tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Asset Tag & Type</th>
                                <th className="px-4 py-3">Brand & Model</th>
                                <th className="px-4 py-3">Serial Number</th>
                                <th className="px-4 py-3">Assigned Location</th>
                                <th className="px-4 py-3">Operational Status</th>
                                <th className="px-4 py-3">Audit History</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredEq.map((item) => {
                                const isAssigned = Boolean(item.pcCode);
                                const historyCount = item.assignmentHistory?.length || 0;

                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    {/* Asset Tag & Type */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-md shrink-0">
                                          {item.type === 'KEYBOARD' && <HardDrive className="w-3.5 h-3.5 text-blue-600" />}
                                          {item.type === 'MOUSE' && <Activity className="w-3.5 h-3.5 text-indigo-600" />}
                                          {item.type === 'MONITOR' && <Monitor className="w-3.5 h-3.5 text-purple-600" />}
                                          {item.type === 'HEADSET' && <Headphones className="w-3.5 h-3.5 text-pink-600" />}
                                          {item.type === 'UPS' && <BatteryCharging className="w-3.5 h-3.5 text-amber-600" />}
                                          {item.type !== 'KEYBOARD' && item.type !== 'MOUSE' && item.type !== 'MONITOR' && item.type !== 'HEADSET' && item.type !== 'UPS' && (
                                            <Package className="w-3.5 h-3.5 text-slate-600" />
                                          )}
                                        </div>
                                        <div>
                                          <div className="font-bold text-slate-900 font-mono text-xs">{item.assetTag}</div>
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 uppercase tracking-tight">
                                            {item.type}
                                          </span>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Brand & Model */}
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-slate-900">{item.brand}</div>
                                      <div className="text-[11px] text-slate-500 line-clamp-1">{item.model}</div>
                                    </td>

                                    {/* Serial Number */}
                                    <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                                      {item.serialNumber}
                                    </td>

                                    {/* Assigned Location */}
                                    <td className="px-4 py-3">
                                      {isAssigned ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-bold rounded text-[11px] inline-flex items-center gap-1">
                                            <Laptop className="w-3 h-3" />
                                            {item.labCode} • {item.pcCode}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 font-medium rounded text-[11px] inline-flex items-center gap-1">
                                          <Package className="w-3 h-3 text-slate-400" />
                                          {item.labCode} Spare Pool
                                        </span>
                                      )}
                                    </td>

                                    {/* Operational Status */}
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                        item.status === 'FUNCTIONAL' || item.status === 'ACTIVE'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : item.status === 'AVAILABLE'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : item.status === 'FAULTY'
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                          : item.status === 'MAINTENANCE'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          item.status === 'FUNCTIONAL' || item.status === 'ACTIVE'
                                            ? 'bg-emerald-500'
                                            : item.status === 'AVAILABLE'
                                            ? 'bg-blue-500'
                                            : item.status === 'FAULTY'
                                            ? 'bg-rose-500'
                                            : item.status === 'MAINTENANCE'
                                            ? 'bg-amber-500'
                                            : 'bg-slate-400'
                                        }`} />
                                        {item.status}
                                      </span>
                                    </td>

                                    {/* Audit History */}
                                    <td className="px-4 py-3">
                                      <button
                                        type="button"
                                        onClick={() => openHistoryModal(item)}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                      >
                                        <History className="w-3 h-3" />
                                        <span>Audit Logs ({historyCount})</span>
                                      </button>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => openAssignModal(item)}
                                          title={isAssigned ? 'Reassign / Unassign Workstation' : 'Assign to Workstation'}
                                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                                        >
                                          <ArrowRightLeft className="w-3.5 h-3.5" />
                                        </button>
                                        {isAssigned && (
                                          <button
                                            type="button"
                                            onClick={() => openReplaceModal(item)}
                                            title="Replace / Swap with Spare"
                                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                                          >
                                            <Wrench className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => openEditEquipmentModal(item)}
                                          title="Edit Equipment"
                                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteEquipment(item)}
                                          title="Delete Equipment"
                                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* MODAL 1: CREATE / EDIT LABORATORY */}
            {labModalMode && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {labModalMode === 'CREATE' ? 'Provision New Laboratory' : `Edit Facility: ${labCodeInput}`}
                        </h3>
                        <p className="text-xs text-slate-500">Configure physical parameters, capacity limits, and operational status.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLabModalMode(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {labFormError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{labFormError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLabFormSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Lab Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={labCodeInput}
                          onChange={(e) => setLabCodeInput(e.target.value.toUpperCase())}
                          placeholder="e.g. LAB-04"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold uppercase focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Operational Status <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={labStatusInput}
                          onChange={(e) => setLabStatusInput(e.target.value as any)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        >
                          <option value="ACTIVE">ACTIVE (Operational)</option>
                          <option value="MAINTENANCE">MAINTENANCE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Laboratory Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={labNameInput}
                        onChange={(e) => setLabNameInput(e.target.value)}
                        placeholder="e.g. Quantum Computing & Distributed Systems Lab"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Building / Wing <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={labBuildingInput}
                          onChange={(e) => setLabBuildingInput(e.target.value)}
                          placeholder="e.g. Science Block C"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Room Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={labRoomInput}
                          onChange={(e) => setLabRoomInput(e.target.value)}
                          placeholder="e.g. Room 402"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Seating Capacity (Max Students) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        required
                        value={labCapacityInput}
                        onChange={(e) => setLabCapacityInput(parseInt(e.target.value) || 30)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Facility Description & Equipment Scope
                      </label>
                      <textarea
                        rows={3}
                        value={labDescInput}
                        onChange={(e) => setLabDescInput(e.target.value)}
                        placeholder="e.g. High-performance GPU workstation cluster specialized for deep learning and neural network training."
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setLabModalMode(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={labFormSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        {labFormSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        {labModalMode === 'CREATE' ? 'Provision Laboratory' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 2: ASSIGN STAFF TO LABORATORY */}
            {staffModalOpen && staffModalLab && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Manage Staff: {staffModalLab.code}
                        </h3>
                        <p className="text-xs text-slate-500">{staffModalLab.name} - Supervisory Personnel</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStaffModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {staffModalError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{staffModalError}</span>
                    </div>
                  )}

                  {/* Search Staff */}
                  <div className="mt-4 relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={staffFilterSearch}
                      onChange={(e) => setStaffFilterSearch(e.target.value)}
                      placeholder="Filter staff by name or email..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {/* Staff Selection Groups */}
                  <div className="mt-4 max-h-72 overflow-y-auto space-y-4 pr-1">
                    {/* Faculty Section */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                        Academic Faculty Professors
                      </div>
                      <div className="space-y-1.5">
                        {allStaffCandidates
                          .filter((u) => u.role === 'FACULTY')
                          .filter((u) =>
                            !staffFilterSearch.trim() ||
                            u.fullName.toLowerCase().includes(staffFilterSearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(staffFilterSearch.toLowerCase())
                          )
                          .map((u) => {
                            const isSelected = selectedStaffIds.includes(u.id);
                            return (
                              <div
                                key={u.id}
                                onClick={() => toggleStaffSelection(u.id)}
                                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <div>
                                    <div className="font-semibold text-xs text-slate-900">{u.fullName}</div>
                                    <div className="text-[10px] text-slate-500">{u.email}</div>
                                  </div>
                                </div>
                                {u.department && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    {u.department}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Lab Assistants Section */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        <Shield className="w-3.5 h-3.5 text-purple-600" />
                        Laboratory Operational Assistants
                      </div>
                      <div className="space-y-1.5">
                        {allStaffCandidates
                          .filter((u) => u.role === 'LAB_ASSISTANT')
                          .filter((u) =>
                            !staffFilterSearch.trim() ||
                            u.fullName.toLowerCase().includes(staffFilterSearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(staffFilterSearch.toLowerCase())
                          )
                          .map((u) => {
                            const isSelected = selectedStaffIds.includes(u.id);
                            return (
                              <div
                                key={u.id}
                                onClick={() => toggleStaffSelection(u.id)}
                                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <div>
                                    <div className="font-semibold text-xs text-slate-900">{u.fullName}</div>
                                    <div className="text-[10px] text-slate-500">{u.email}</div>
                                  </div>
                                </div>
                                {u.department && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    {u.department}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Summary & Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                    <span className="text-xs font-medium text-slate-500">
                      {selectedStaffIds.length} staff member(s) assigned
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStaffModalOpen(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveStaffAssignments}
                        disabled={staffModalSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        {staffModalSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Save Personnel Assignments
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 3: DEPENDENCY PROTECTION ALERT ON DELETE */}
            {deleteDependencyAlert && deleteDependencyAlert.open && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-rose-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                  <div className="flex items-center gap-3 pb-3 border-b border-rose-100 text-rose-600">
                    <div className="p-2 bg-rose-50 rounded-lg">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Cannot Delete Laboratory</h3>
                      <p className="text-xs text-slate-500">Foreign key dependency protection active</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {deleteDependencyAlert.message}
                    </p>

                    {deleteDependencyAlert.dependencies && (
                      <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3 space-y-1.5 text-xs">
                        <div className="font-semibold text-slate-800">Referenced Relationships:</div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Workstation Computers:</span>
                          <span className="font-bold text-rose-700">
                            {deleteDependencyAlert.dependencies.computersCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Academic Classes:</span>
                          <span className="font-bold text-rose-700">
                            {deleteDependencyAlert.dependencies.classesCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Student Sessions:</span>
                          <span className="font-bold text-rose-700">
                            {deleteDependencyAlert.dependencies.sessionsCount}
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 italic">
                      Please reassign workstations and academic classes to another facility before decommissioning laboratory '{deleteDependencyAlert.labCode}'.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDeleteDependencyAlert(null)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Acknowledge & Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 4: CREATE / EDIT WORKSTATION NODE */}
            {pcModalMode && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {pcModalMode === 'CREATE' ? 'Register Workstation Node' : `Edit Workstation: ${pcFormCode}`}
                        </h3>
                        <p className="text-xs text-slate-500">Configure terminal identity, hardware specifications, and node state.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPcModalMode(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {pcFormError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{pcFormError}</span>
                    </div>
                  )}

                  <form onSubmit={handlePcFormSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Laboratory Facility <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={pcFormLabCode}
                          onChange={(e) => setPcFormLabCode(e.target.value)}
                          required
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        >
                          {labs.map((l) => (
                            <option key={l.id} value={l.code}>
                              {l.code} ({l.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Workstation Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={pcFormCode}
                          onChange={(e) => setPcFormCode(e.target.value.toUpperCase())}
                          placeholder="e.g. PC-01"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold uppercase focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Hostname
                        </label>
                        <input
                          type="text"
                          value={pcFormHostname}
                          onChange={(e) => setPcFormHostname(e.target.value)}
                          placeholder="e.g. LAB01-PC01"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Operational State <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={pcFormState}
                          onChange={(e) => setPcFormState(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white font-semibold"
                        >
                          <option value="AVAILABLE">AVAILABLE (Ready)</option>
                          <option value="IN_USE">IN_USE</option>
                          <option value="MAINTENANCE">MAINTENANCE</option>
                          <option value="DISABLED">DISABLED</option>
                          <option value="OFFLINE">OFFLINE</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Static / Assigned IP
                        </label>
                        <input
                          type="text"
                          value={pcFormIp}
                          onChange={(e) => setPcFormIp(e.target.value)}
                          placeholder="192.168.1.101"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          MAC Address
                        </label>
                        <input
                          type="text"
                          value={pcFormMac}
                          onChange={(e) => setPcFormMac(e.target.value.toUpperCase())}
                          placeholder="00:1B:44:11:3A:B7"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono uppercase focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-blue-600" />
                        <span>Hardware Specifications</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Processor / CPU Model
                        </label>
                        <input
                          type="text"
                          value={pcFormCpu}
                          onChange={(e) => setPcFormCpu(e.target.value)}
                          placeholder="Intel Core i7-13700 / AMD Ryzen 7"
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-hidden focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            RAM Capacity (GB)
                          </label>
                          <input
                            type="number"
                            min="2"
                            max="512"
                            value={pcFormRam}
                            onChange={(e) => setPcFormRam(parseInt(e.target.value) || 16)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-hidden focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Primary Storage (GB)
                          </label>
                          <input
                            type="number"
                            min="64"
                            max="8192"
                            value={pcFormDisk}
                            onChange={(e) => setPcFormDisk(parseInt(e.target.value) || 512)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-hidden focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPcModalMode(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={pcFormSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        {pcFormSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        {pcModalMode === 'CREATE' ? 'Register Workstation' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 5: CREATE / EDIT EQUIPMENT ASSET */}
            {equipmentModalMode && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {equipmentModalMode === 'CREATE' ? 'Register Physical Peripheral Asset' : `Edit Peripheral: ${eqAssetTag}`}
                        </h3>
                        <p className="text-xs text-slate-500">Asset accountability, serial tracking, and workstation allocation.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEquipmentModalMode(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {eqFormError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{eqFormError}</span>
                    </div>
                  )}

                  <form onSubmit={handleEquipmentFormSubmit} className="mt-4 space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Asset Tag <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={eqAssetTag}
                          onChange={(e) => setEqAssetTag(e.target.value.toUpperCase())}
                          placeholder="e.g. AST-KB-0103"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold uppercase font-mono focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Peripheral Type <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={eqType}
                          onChange={(e) => setEqType(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        >
                          <option value="KEYBOARD">KEYBOARD</option>
                          <option value="MOUSE">MOUSE</option>
                          <option value="MONITOR">MONITOR</option>
                          <option value="HEADSET">HEADSET</option>
                          <option value="UPS">UPS (Power Supply)</option>
                          <option value="GPU">GPU (Add-on Card)</option>
                          <option value="OTHER">OTHER PERIPHERAL</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Brand / Manufacturer <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={eqBrand}
                          onChange={(e) => setEqBrand(e.target.value)}
                          placeholder="e.g. Dell, Logitech, HP"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Model Name / Spec <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={eqModel}
                          onChange={(e) => setEqModel(e.target.value)}
                          placeholder="e.g. KB216 Wired Keyboard"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Hardware Serial Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={eqSerial}
                          onChange={(e) => setEqSerial(e.target.value)}
                          placeholder="e.g. CN-0K791N-71616"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Status <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={eqStatus}
                          onChange={(e) => setEqStatus(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        >
                          <option value="FUNCTIONAL">FUNCTIONAL (Operational)</option>
                          <option value="AVAILABLE">AVAILABLE (In Pool)</option>
                          <option value="FAULTY">FAULTY (Defective)</option>
                          <option value="MAINTENANCE">MAINTENANCE (Repair)</option>
                          <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Assigned Facility <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={eqLabCode}
                          onChange={(e) => {
                            setEqLabCode(e.target.value);
                            setEqPcCode('');
                          }}
                          required
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        >
                          {labs.map((l) => (
                            <option key={l.id} value={l.code}>
                              {l.code} - {l.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Attached Workstation (Optional)
                        </label>
                        <select
                          value={eqPcCode}
                          onChange={(e) => setEqPcCode(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        >
                          <option value="">None (Keep in Facility Spare Pool)</option>
                          {computers
                            .filter((c) => c.labCode === eqLabCode)
                            .map((c) => (
                              <option key={c.id} value={c.pcCode}>
                                {c.pcCode} ({c.hostname || 'Node'})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Procurement Date
                        </label>
                        <input
                          type="date"
                          value={eqPurchaseDate}
                          onChange={(e) => setEqPurchaseDate(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Warranty Expiry Date
                        </label>
                        <input
                          type="date"
                          value={eqWarranty}
                          onChange={(e) => setEqWarranty(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Technical Notes & Condition
                      </label>
                      <textarea
                        rows={2}
                        value={eqNotes}
                        onChange={(e) => setEqNotes(e.target.value)}
                        placeholder="e.g. Standard batch delivery, includes USB braided cord and braided cable."
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEquipmentModalMode(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={eqFormSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        {eqFormSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        {equipmentModalMode === 'CREATE' ? 'Register Equipment' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 6: ASSIGN / REASSIGN PERIPHERAL */}
            {assignModalOpen && assigningEquipment && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Assign / Reassign Peripheral
                        </h3>
                        <p className="text-xs text-slate-500">{assigningEquipment.assetTag} ({assigningEquipment.brand} {assigningEquipment.model})</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssignModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {assignError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{assignError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAssignSubmit} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Facility
                      </label>
                      <select
                        value={assignLabCode}
                        onChange={(e) => {
                          setAssignLabCode(e.target.value);
                          setAssignPcCode('');
                        }}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      >
                        {labs.map((l) => (
                          <option key={l.id} value={l.code}>
                            {l.code} - {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Workstation Allocation Target
                      </label>
                      <select
                        value={assignPcCode}
                        onChange={(e) => setAssignPcCode(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      >
                        <option value="">None (Return to Facility Spare Pool)</option>
                        {computers
                          .filter((c) => c.labCode === assignLabCode)
                          .map((c) => (
                            <option key={c.id} value={c.pcCode}>
                              {c.pcCode} ({c.hostname || 'Workstation Node'})
                            </option>
                          ))}
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {assignPcCode ? `Equipment will be bound to ${assignLabCode} • ${assignPcCode}.` : 'Equipment will be detached and marked as available spare.'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Reason / Reallocation Note
                      </label>
                      <input
                        type="text"
                        value={assignReason}
                        onChange={(e) => setAssignReason(e.target.value)}
                        placeholder="e.g. Workstation lab upgrade or replacement"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setAssignModalOpen(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={assignSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        {assignSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Confirm Allocation
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 7: REPLACE / SWAP WITH SPARE */}
            {replaceModalOpen && replacingEquipment && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Swap Defective Peripheral
                        </h3>
                        <p className="text-xs text-slate-500">Atomic workstation swap with available spare</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplaceModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                    <div className="font-bold text-amber-900 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Currently Attached Peripheral:</span>
                    </div>
                    <div className="text-slate-800 font-semibold">
                      {replacingEquipment.assetTag} ({replacingEquipment.brand} {replacingEquipment.model})
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Workstation: <span className="font-bold">{replacingEquipment.labCode} • {replacingEquipment.pcCode}</span>
                    </div>
                  </div>

                  {replaceError && (
                    <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{replaceError}</span>
                    </div>
                  )}

                  <form onSubmit={handleReplaceSubmit} className="mt-4 space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select Functional Spare from Pool <span className="text-rose-500">*</span>
                      </label>
                      {(() => {
                        const spares = equipment.filter(
                          (e) =>
                            e.id !== replacingEquipment.id &&
                            e.type === replacingEquipment.type &&
                            !e.pcCode &&
                            e.status !== 'FAULTY' &&
                            e.status !== 'DECOMMISSIONED'
                        );
                        if (spares.length === 0) {
                          return (
                            <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium">
                              No compatible spare {replacingEquipment.type} items available in pool. Please register a spare first.
                            </div>
                          );
                        }
                        return (
                          <select
                            value={replacementEquipmentId}
                            onChange={(e) => setReplacementEquipmentId(e.target.value)}
                            required
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                          >
                            {spares.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.assetTag} - {s.brand} {s.model} ({s.labCode} Pool)
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Defect Diagnosis / Reason
                      </label>
                      <input
                        type="text"
                        value={replaceReason}
                        onChange={(e) => setReplaceReason(e.target.value)}
                        placeholder="e.g. Key switches sticking / Cable frayed"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Fault Notes (Logged to Old Asset)
                      </label>
                      <textarea
                        rows={2}
                        value={replaceDefectNotes}
                        onChange={(e) => setReplaceDefectNotes(e.target.value)}
                        placeholder="e.g. Unit marked for RMA / vendor repair replacement."
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setReplaceModalOpen(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={replaceSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        {replaceSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Execute Hardware Swap
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 8: ASSIGNMENT HISTORY AUDIT TRAIL */}
            {historyModalOpen && historyEquipment && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <History className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Assignment History Audit
                        </h3>
                        <p className="text-xs text-slate-500">{historyEquipment.assetTag} ({historyEquipment.brand} {historyEquipment.model})</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHistoryModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                    {(!historyEquipment.assignmentHistory || historyEquipment.assignmentHistory.length === 0) ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No assignment history records logged for this peripheral.
                      </div>
                    ) : (
                      historyEquipment.assignmentHistory.map((h: any, idx: number) => (
                        <div key={h.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              h.action === 'ASSIGN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : h.action === 'REASSIGN'
                                ? 'bg-blue-100 text-blue-800'
                                : h.action === 'REPLACE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {h.action}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(h.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-slate-800 font-semibold">
                            {h.previousPcCode ? `From: ${h.previousLabCode} • ${h.previousPcCode}` : 'From: Spare Pool'} ➔ {h.newPcCode ? `To: ${h.newLabCode} • ${h.newPcCode}` : 'To: Spare Pool'}
                          </div>
                          {h.reason && (
                            <div className="text-[11px] text-slate-600">
                              Reason: {h.reason}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                            <span>Logged by: {h.performedByUserName || h.performedByUserId}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
                    <button
                      type="button"
                      onClick={() => setHistoryModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Close Audit Log
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACADEMIC SETUP TAB (Phase 5) */}
        {activeTab === 'academic' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Institutional Academic Setup & Curriculum</h2>
                <p className="text-xs text-slate-500">
                  Configure departments, degree courses, laboratory subjects, class offerings, calendar years, and sections.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadAcademicData}
                  disabled={loadingAcademic}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  title="Refresh academic data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAcademic ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Sub-Tab Navigation Strip */}
            <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-wrap gap-1">
              {[
                { id: 'departments', label: 'Departments & Courses', icon: Building2 },
                { id: 'subjects', label: 'Subjects & Curriculum', icon: BookMarked },
                { id: 'classes', label: 'Academic Class Offerings', icon: GraduationCap },
                { id: 'calendar', label: 'Academic Calendar & Sections', icon: Calendar }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = academicSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setAcademicSubTab(tab.id as any);
                      setAcademicSearch('');
                    }}
                    className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUBTAB 1: DEPARTMENTS & COURSES */}
            {academicSubTab === 'departments' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Departments Card */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Academic Departments</h3>
                      <p className="text-[11px] text-slate-500">Organizational faculty departments</p>
                    </div>
                    <button
                      onClick={() => handleOpenAcademicModal('DEPT', 'CREATE')}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Dept</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Code</th>
                          <th className="px-4 py-2.5">Department Name</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {departments.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                              No departments found. Click &apos;Add Dept&apos; to register one.
                            </td>
                          </tr>
                        ) : (
                          departments.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold font-mono text-blue-600">{d.code}</td>
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-800">{d.name}</div>
                                {d.description && <div className="text-[10px] text-slate-400">{d.description}</div>}
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleOpenAcademicModal('DEPT', 'EDIT', d)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit department"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAcademic('departments', d.id, `Department ${d.code}`)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete department"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Courses Card */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Degree Courses & Programs</h3>
                      <p className="text-[11px] text-slate-500">Curricula tied to departments</p>
                    </div>
                    <button
                      onClick={() => handleOpenAcademicModal('COURSE', 'CREATE')}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Course</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Course Code</th>
                          <th className="px-4 py-2.5">Program Name</th>
                          <th className="px-4 py-2.5">Dept</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {courses.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                              No courses found. Click &apos;Add Course&apos; to register one.
                            </td>
                          </tr>
                        ) : (
                          courses.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold font-mono text-slate-900">{c.code}</td>
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-800">{c.name}</div>
                                <span className="text-[10px] text-slate-400">{c.degreeLevel || 'Undergraduate'}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                                  {c.departmentCode || 'GEN'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleOpenAcademicModal('COURSE', 'EDIT', c)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit course"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAcademic('courses', c.id, `Course ${c.code}`)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete course"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 2: SUBJECTS & CURRICULUM */}
            {academicSubTab === 'subjects' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Laboratory Subjects Registry</h3>
                    <p className="text-[11px] text-slate-500">Curricular laboratory subjects taught in computer facilities</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={academicSearch}
                        onChange={(e) => setAcademicSearch(e.target.value)}
                        placeholder="Search subjects..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      onClick={() => handleOpenAcademicModal('SUBJECT', 'CREATE')}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Subject</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Subject Code</th>
                        <th className="px-4 py-2.5">Subject Title</th>
                        <th className="px-4 py-2.5">Dept</th>
                        <th className="px-4 py-2.5">Semester</th>
                        <th className="px-4 py-2.5">Credits</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjects.filter(s =>
                        !academicSearch ||
                        s.code.toLowerCase().includes(academicSearch.toLowerCase()) ||
                        s.name.toLowerCase().includes(academicSearch.toLowerCase())
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                            No laboratory subjects found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        subjects
                          .filter(s =>
                            !academicSearch ||
                            s.code.toLowerCase().includes(academicSearch.toLowerCase()) ||
                            s.name.toLowerCase().includes(academicSearch.toLowerCase())
                          )
                          .map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold font-mono text-blue-600">{s.code}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-800">{s.name}</td>
                              <td className="px-4 py-2.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                                  {s.departmentCode || 'GEN'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">Semester {s.semester}</td>
                              <td className="px-4 py-2.5 text-slate-600">{s.credits || 2} credits</td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleOpenAcademicModal('SUBJECT', 'EDIT', s)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit subject"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAcademic('subjects', s.id, `Subject ${s.code}`)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete subject"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB 3: ACADEMIC CLASS OFFERINGS */}
            {academicSubTab === 'classes' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Academic Class Offerings</h3>
                    <p className="text-[11px] text-slate-500">Live lab classes mapping curriculum, semester, faculty, and default facility</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={academicSearch}
                        onChange={(e) => setAcademicSearch(e.target.value)}
                        placeholder="Search class offerings..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      onClick={() => handleOpenAcademicModal('CLASS', 'CREATE')}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Class</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Class Offering</th>
                        <th className="px-4 py-2.5">Course / Subject</th>
                        <th className="px-4 py-2.5">Term & Section</th>
                        <th className="px-4 py-2.5">Assigned Faculty</th>
                        <th className="px-4 py-2.5">Default Lab</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classes.filter(cl =>
                        !academicSearch ||
                        (cl.name && cl.name.toLowerCase().includes(academicSearch.toLowerCase())) ||
                        (cl.courseCode && cl.courseCode.toLowerCase().includes(academicSearch.toLowerCase())) ||
                        (cl.subjectCode && cl.subjectCode.toLowerCase().includes(academicSearch.toLowerCase())) ||
                        (cl.assignedFacultyName && cl.assignedFacultyName.toLowerCase().includes(academicSearch.toLowerCase()))
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                            No class offerings found. Click &apos;Create Class&apos; to schedule one.
                          </td>
                        </tr>
                      ) : (
                        classes
                          .filter(cl =>
                            !academicSearch ||
                            (cl.name && cl.name.toLowerCase().includes(academicSearch.toLowerCase())) ||
                            (cl.courseCode && cl.courseCode.toLowerCase().includes(academicSearch.toLowerCase())) ||
                            (cl.subjectCode && cl.subjectCode.toLowerCase().includes(academicSearch.toLowerCase())) ||
                            (cl.assignedFacultyName && cl.assignedFacultyName.toLowerCase().includes(academicSearch.toLowerCase()))
                          )
                          .map((cl) => (
                            <tr key={cl.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5">
                                <div className="font-bold text-slate-900">{cl.name || 'Unnamed Class'}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{cl.academicYear}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-800">{cl.subjectName || cl.subjectCode}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{cl.courseCode} • {cl.subjectCode}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-slate-700">Sem {cl.semester} (Sec {cl.section})</span>
                              </td>
                              <td className="px-4 py-2.5">
                                {cl.assignedFacultyName ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    {cl.assignedFacultyName}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Unassigned</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {cl.defaultLabCode ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                    {cl.defaultLabCode}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Any Lab</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>{cl.status || 'ACTIVE'}</span>
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleOpenAcademicModal('CLASS', 'EDIT', cl)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit class offering"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAcademic('classes', cl.id, `Class Offering '${cl.name}'`)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete class offering"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB 4: ACADEMIC CALENDAR & SECTIONS */}
            {academicSubTab === 'calendar' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Academic Years Card */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Academic Years Calendar</h3>
                      <p className="text-[11px] text-slate-500">Institutional session cycles</p>
                    </div>
                    <button
                      onClick={() => handleOpenAcademicModal('YEAR', 'CREATE')}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Year</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Academic Year</th>
                          <th className="px-4 py-2.5">Current Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {academicYears.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                              No academic years configured.
                            </td>
                          </tr>
                        ) : (
                          academicYears.map((y) => (
                            <tr key={y.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold font-mono text-slate-900">{y.year}</td>
                              <td className="px-4 py-2.5">
                                {y.isCurrent ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>Current Active Year</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Archived / Upcoming</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleOpenAcademicModal('YEAR', 'EDIT', y)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit year"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAcademic('academic-years', y.id, `Academic Year ${y.year}`)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete year"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Class Sections Card */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Class Cohort Sections</h3>
                      <p className="text-[11px] text-slate-500">Institutional section identifiers</p>
                    </div>
                    <button
                      onClick={() => handleOpenAcademicModal('SECTION', 'CREATE')}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Section</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Section Name</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sections.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                              No sections configured. Click &apos;Add Section&apos; to register one.
                            </td>
                          </tr>
                        ) : (
                          sections.map((sec) => (
                            <tr key={sec.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold font-mono text-slate-900">Section {sec.name}</td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleDeleteAcademic('sections', sec.id, `Section ${sec.name}`)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete section"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* UNIFIED ACADEMIC CREATION & EDIT MODAL */}
            {academicModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {academicModalMode === 'CREATE' ? 'Add New ' : 'Edit '}
                        {academicModal === 'DEPT' && 'Department'}
                        {academicModal === 'COURSE' && 'Degree Course'}
                        {academicModal === 'SUBJECT' && 'Laboratory Subject'}
                        {academicModal === 'CLASS' && 'Academic Class Offering'}
                        {academicModal === 'YEAR' && 'Academic Year'}
                        {academicModal === 'SECTION' && 'Class Section'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Configure institutional academic structure</p>
                    </div>
                    <button
                      onClick={() => setAcademicModal(null)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Error Alert */}
                  {academicFormError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{academicFormError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveAcademic} className="mt-4 space-y-4">
                    {/* DEPARTMENT FORM */}
                    {academicModal === 'DEPT' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Department Code *
                          </label>
                          <input
                            type="text"
                            value={deptCode}
                            onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                            placeholder="e.g. CSE, ECE, MECH"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Department Full Name *
                          </label>
                          <input
                            type="text"
                            value={deptName}
                            onChange={(e) => setDeptName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            placeholder="e.g. Computer Science & Engineering"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Description
                          </label>
                          <textarea
                            value={deptDesc}
                            onChange={(e) => setDeptDesc(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            placeholder="Optional department description"
                            rows={2}
                          />
                        </div>
                      </>
                    )}

                    {/* COURSE FORM */}
                    {academicModal === 'COURSE' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Course Code *
                          </label>
                          <input
                            type="text"
                            value={courseCode}
                            onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                            placeholder="e.g. BTECH-CSE"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Course / Program Name *
                          </label>
                          <input
                            type="text"
                            value={courseName}
                            onChange={(e) => setCourseName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            placeholder="e.g. B.Tech in Computer Science"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Parent Department *
                            </label>
                            <select
                              value={courseDeptId}
                              onChange={(e) => setCourseDeptId(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                              required
                            >
                              <option value="">Select Department</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Degree Level
                            </label>
                            <select
                              value={courseDegreeLevel}
                              onChange={(e) => setCourseDegreeLevel(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="Undergraduate">Undergraduate</option>
                              <option value="Postgraduate">Postgraduate</option>
                              <option value="Diploma">Diploma</option>
                              <option value="Doctoral">Doctoral</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {/* SUBJECT FORM */}
                    {academicModal === 'SUBJECT' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Subject Code *
                            </label>
                            <input
                              type="text"
                              value={subjectCode}
                              onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                              placeholder="e.g. CS301"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Department
                            </label>
                            <select
                              value={subjectDeptId}
                              onChange={(e) => setSubjectDeptId(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="">Select Dept</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.code}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Subject Title *
                          </label>
                          <input
                            type="text"
                            value={subjectName}
                            onChange={(e) => setSubjectName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            placeholder="e.g. Data Structures & Algorithms Lab"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Semester *
                            </label>
                            <select
                              value={subjectSemester}
                              onChange={(e) => setSubjectSemester(Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                              required
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                <option key={s} value={s}>Semester {s}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Credits
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="6"
                              value={subjectCredits}
                              onChange={(e) => setSubjectCredits(Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* ACADEMIC YEAR FORM */}
                    {academicModal === 'YEAR' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Academic Year Session *
                          </label>
                          <input
                            type="text"
                            value={yearString}
                            onChange={(e) => setYearString(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                            placeholder="e.g. 2026-2027"
                            required
                          />
                        </div>
                        <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={yearIsCurrent}
                            onChange={(e) => setYearIsCurrent(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span className="font-semibold">Mark as Current Active Session</span>
                        </label>
                      </>
                    )}

                    {/* SECTION FORM */}
                    {academicModal === 'SECTION' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Section Name / Identifier *
                          </label>
                          <input
                            type="text"
                            value={sectionName}
                            onChange={(e) => setSectionName(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                            placeholder="e.g. A, B, C or CSE-1"
                            required
                          />
                        </div>
                      </>
                    )}

                    {/* CLASS OFFERING FORM */}
                    {academicModal === 'CLASS' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Offering Name (Optional)
                          </label>
                          <input
                            type="text"
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            placeholder="Defaults to Subject Name (Sec X)"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Degree Course *
                            </label>
                            <select
                              value={classCourseId}
                              onChange={(e) => setClassCourseId(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                              required
                            >
                              <option value="">Select Course</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Subject *
                            </label>
                            <select
                              value={classSubjectId}
                              onChange={(e) => setClassSubjectId(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                              required
                            >
                              <option value="">Select Subject</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Academic Year *
                            </label>
                            <select
                              value={classYear}
                              onChange={(e) => setClassYear(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                              required
                            >
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.year}>{y.year}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Semester *
                            </label>
                            <select
                              value={classSemester}
                              onChange={(e) => setClassSemester(Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                              required
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                <option key={s} value={s}>Sem {s}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Section *
                            </label>
                            <select
                              value={classSection}
                              onChange={(e) => setClassSection(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                              required
                            >
                              {sections.map((sec) => (
                                <option key={sec.id} value={sec.name}>Sec {sec.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Assigned Faculty
                            </label>
                            <select
                              value={classFacultyId}
                              onChange={(e) => setClassFacultyId(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="">Unassigned</option>
                              {facultyList.map((f) => (
                                <option key={f.id} value={f.id}>{f.fullName}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Default Laboratory
                            </label>
                            <select
                              value={classLabCode}
                              onChange={(e) => setClassLabCode(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                            >
                              <option value="">Any Laboratory</option>
                              {labs.map((l) => (
                                <option key={l.id} value={l.code}>{l.code} ({l.name})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Enrollment Policy *
                            </label>
                            <select
                              value={classEnrollmentPolicy}
                              onChange={(e) => setClassEnrollmentPolicy(e.target.value as any)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                            >
                              <option value="DIRECT">DIRECT (Immediate Enrollment)</option>
                              <option value="APPROVAL_REQUIRED">APPROVAL_REQUIRED (Admin Sign-off)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Student Capacity Limits
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="200"
                              value={classCapacity}
                              onChange={(e) => setClassCapacity(parseInt(e.target.value) || 40)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setAcademicModal(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={academicSubmitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                      >
                        {academicSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>
                          {academicModalMode === 'CREATE' ? 'Create Entity' : 'Save Changes'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STUDENT ENROLLMENT & REQUEST TRIAGE TAB (Phase 10) */}
        {activeTab === 'enrollment' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Student Enrollment Cockpit & Institutional Approvals</h2>
                  {pendingRequestsCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                      {pendingRequestsCount} Pending Review
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dual-mode student onboarding, class roster governance, faculty approval request triage, and automated lab credential provisioning.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => openDirectEnrollModal(selectedClassForRoster || classes[0]?.id)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Enroll Student into Class</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetchEnrollmentRequests();
                    await loadAcademicData();
                    if (selectedClassForRoster) await fetchClassRoster(selectedClassForRoster);
                    await fetchAllStudents();
                  }}
                  disabled={loadingRequests}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  title="Refresh enrollment data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Telemetry KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`bg-white border rounded-xl p-4 shadow-xs transition-all ${
                pendingRequestsCount > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
                    <p className={`text-2xl font-bold mt-1 ${pendingRequestsCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {pendingRequestsCount}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Faculty enrollment requests</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${pendingRequestsCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Approved Requests</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {enrollmentRequests.filter((r) => r.status === 'APPROVED').length}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Granted lab authorizations</p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Offerings</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{classes.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Scheduled lab curriculum</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Enrolled Seats</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {classes.reduce((sum, c) => sum + (c.enrolledCount || 0), 0)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Students across all classes</p>
                  </div>
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Navigation Pill Strip */}
            <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-wrap gap-1">
              {[
                { id: 'requests', label: 'Enrollment Requests Triage', icon: Clock, badge: pendingRequestsCount },
                { id: 'rosters', label: 'Class Rosters & Direct Enrollment', icon: GraduationCap },
                { id: 'students', label: 'Student Directory & Quick Enroll', icon: Users }
              ].map((tab: any) => {
                const Icon = tab.icon;
                const isSelected = enrollmentSubView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setEnrollmentSubView(tab.id);
                      if (tab.id === 'rosters' && !selectedClassForRoster && classes.length > 0) {
                        setSelectedClassForRoster(classes[0].id);
                        fetchClassRoster(classes[0].id);
                      }
                      if (tab.id === 'students') {
                        fetchAllStudents();
                      }
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.badge && tab.badge > 0 ? (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isSelected ? 'bg-white text-blue-700' : 'bg-amber-500 text-white animate-pulse'
                      }`}>
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* SUBVIEW 1: ENROLLMENT REQUESTS TRIAGE */}
            {enrollmentSubView === 'requests' && (
              <div className="space-y-4">
                {/* Filter Toolbar */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 mr-1">Status:</span>
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
                      const count = st === 'ALL'
                        ? enrollmentRequests.length
                        : enrollmentRequests.filter((r) => r.status === st).length;
                      const active = requestStatusFilter === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setRequestStatusFilter(st)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                            active
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>{st}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            active ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    <div className="h-4 w-px bg-slate-200 mx-2 hidden sm:block"></div>

                    {/* Class filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">Offering:</span>
                      <select
                        value={requestClassFilter}
                        onChange={(e) => setRequestClassFilter(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="ALL">All Class Offerings</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.courseCode} - {c.name} (Sec {c.section})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      placeholder="Search student or faculty..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Requests Table */}
                {(() => {
                  let filtered = enrollmentRequests;
                  if (requestStatusFilter !== 'ALL') {
                    filtered = filtered.filter((r) => r.status === requestStatusFilter);
                  }
                  if (requestClassFilter !== 'ALL') {
                    filtered = filtered.filter((r) => r.classId === requestClassFilter);
                  }
                  if (requestSearch.trim()) {
                    const q = requestSearch.toLowerCase().trim();
                    filtered = filtered.filter(
                      (r) =>
                        r.studentName?.toLowerCase().includes(q) ||
                        r.studentId?.toLowerCase().includes(q) ||
                        r.className?.toLowerCase().includes(q) ||
                        r.requestedByUserName?.toLowerCase().includes(q)
                    );
                  }

                  return (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      {filtered.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <h3 className="text-sm font-bold text-slate-700">No Enrollment Requests</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {requestStatusFilter === 'PENDING'
                              ? 'All student enrollment requests have been triaged and resolved.'
                              : 'No requests match the selected filters.'}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px] tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Student Details</th>
                                <th className="px-4 py-3">Class Offering</th>
                                <th className="px-4 py-3">Requested By</th>
                                <th className="px-4 py-3">Institutional Policy</th>
                                <th className="px-4 py-3">Review Status</th>
                                <th className="px-4 py-3">Review Notes / Decision</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filtered.map((req) => {
                                const isPending = req.status === 'PENDING';
                                return (
                                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                                    {/* Student Details */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                                          {(req.studentName || req.studentId || 'S').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <div className="font-bold text-slate-900">{req.studentName}</div>
                                          <div className="text-[11px] text-slate-500 font-mono">ID: {req.studentId}</div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Class Offering */}
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-slate-800">{req.className}</div>
                                      <div className="text-[11px] text-slate-500 font-mono">
                                        {req.courseCode} • Sec {req.section}
                                      </div>
                                    </td>

                                    {/* Requested By */}
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-slate-800">{req.requestedByUserName}</div>
                                      <div className="text-[10px] text-slate-400">
                                        {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </td>

                                    {/* Institutional Policy */}
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        <Shield className="w-3 h-3" />
                                        APPROVAL_REQUIRED
                                      </span>
                                    </td>

                                    {/* Review Status */}
                                    <td className="px-4 py-3">
                                      {req.status === 'PENDING' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                          PENDING REVIEW
                                        </span>
                                      )}
                                      {req.status === 'APPROVED' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          APPROVED
                                        </span>
                                      )}
                                      {req.status === 'REJECTED' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                          <X className="w-3 h-3 text-rose-600" />
                                          REJECTED
                                        </span>
                                      )}
                                    </td>

                                    {/* Review Notes / Decision */}
                                    <td className="px-4 py-3 max-w-xs">
                                      {req.reviewNotes ? (
                                        <div>
                                          <p className="text-[11px] text-slate-700 italic">&ldquo;{req.reviewNotes}&rdquo;</p>
                                          {req.reviewedByUserName && (
                                            <p className="text-[10px] text-slate-400 mt-0.5">By {req.reviewedByUserName}</p>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 text-[11px]">Awaiting review</span>
                                      )}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      {isPending ? (
                                        <div className="flex items-center justify-end space-x-1.5">
                                          <button
                                            type="button"
                                            onClick={() => openReviewModal(req, 'APPROVE')}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                            title="Approve student enrollment and provision lab access"
                                          >
                                            <UserCheck className="w-3.5 h-3.5" />
                                            <span>Approve</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => openReviewModal(req, 'REJECT')}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold transition-colors cursor-pointer"
                                            title="Reject enrollment request"
                                          >
                                            <UserX className="w-3.5 h-3.5" />
                                            <span>Reject</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-slate-400 font-medium">Completed</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUBVIEW 2: CLASS ROSTERS & DIRECT ENROLLMENT */}
            {enrollmentSubView === 'rosters' && (
              <div className="space-y-4">
                {/* Offering Selection & Class Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                        Select Academic Class Offering:
                      </label>
                      <select
                        value={selectedClassForRoster}
                        onChange={(e) => {
                          setSelectedClassForRoster(e.target.value);
                          fetchClassRoster(e.target.value);
                        }}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.courseCode} - {c.name} (Sec {c.section} • {c.academicYear} Sem {c.semester})
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const sel = classes.find((c) => c.id === selectedClassForRoster);
                      if (!sel) return null;
                      const capacity = sel.capacity || 40;
                      const enrolled = classRosterStudents.length;
                      const pct = Math.min(100, Math.round((enrolled / capacity) * 100));

                      return (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 min-w-[160px]">
                            <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1">
                              <span>Seat Capacity</span>
                              <span className="font-bold text-slate-900">{enrolled} / {capacity}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-slate-500">Default Lab: <strong className="text-slate-800 font-mono">{sel.defaultLabCode || 'None'}</strong></span>
                            <span className="text-slate-500">Policy: <strong className="text-blue-700">{sel.enrollmentPolicy || 'DIRECT'}</strong></span>
                          </div>

                          <button
                            type="button"
                            onClick={() => openDirectEnrollModal(sel.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Enroll Student</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Class Roster Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3">
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Enrolled Student Roster</h3>
                      <p className="text-[11px] text-slate-500">
                        Active roster of students authorized for laboratory sessions in this class offering.
                      </p>
                    </div>
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Filter enrolled roster..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {(() => {
                    let roster = classRosterStudents;
                    if (rosterSearch.trim()) {
                      const q = rosterSearch.toLowerCase().trim();
                      roster = roster.filter(
                        (s) =>
                          s.fullName?.toLowerCase().includes(q) ||
                          s.studentId?.toLowerCase().includes(q) ||
                          s.email?.toLowerCase().includes(q)
                      );
                    }

                    if (roster.length === 0) {
                      return (
                        <div className="p-12 text-center text-slate-400">
                          <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <h3 className="text-sm font-bold text-slate-700">No Enrolled Students</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            There are currently no students enrolled in this class offering.
                          </p>
                          <button
                            type="button"
                            onClick={() => openDirectEnrollModal(selectedClassForRoster)}
                            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Enroll Student</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                            <tr>
                              <th className="px-4 py-2.5">Student ID & Roll No</th>
                              <th className="px-4 py-2.5">Full Name & Email</th>
                              <th className="px-4 py-2.5">Academic Placement</th>
                              <th className="px-4 py-2.5">Enrolled Date</th>
                              <th className="px-4 py-2.5">Status</th>
                              <th className="px-4 py-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {roster.map((st) => (
                              <tr key={st.id || st.userId} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 font-bold font-mono text-blue-600">{st.studentId}</td>
                                <td className="px-4 py-2.5">
                                  <div className="font-semibold text-slate-800">{st.fullName}</div>
                                  <div className="text-[10px] text-slate-400">{st.email}</div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="font-medium text-slate-700">{st.department || 'General'}</span>
                                  <div className="text-[10px] text-slate-500">{st.course} • Sec {st.section}</div>
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                  {st.enrolledAt ? new Date(st.enrolledAt).toLocaleDateString() : 'Active'}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>ENROLLED</span>
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleUnenrollStudent(selectedClassForRoster, st.studentId, st.fullName)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                    title="Unenroll student from class offering"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* SUBVIEW 3: ALL REGISTERED STUDENTS DIRECTORY */}
            {enrollmentSubView === 'students' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Student Directory Registry</h3>
                    <p className="text-[11px] text-slate-500">
                      Search and quick-enroll registered students across institutional laboratory offerings.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={studentDirDeptFilter}
                      onChange={(e) => setStudentDirDeptFilter(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>

                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={studentDirSearch}
                        onChange={(e) => setStudentDirSearch(e.target.value)}
                        placeholder="Search student ID, name, email..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  let list = allStudentsList;
                  if (studentDirDeptFilter !== 'ALL') {
                    list = list.filter((s) => s.department === studentDirDeptFilter);
                  }
                  if (studentDirSearch.trim()) {
                    const q = studentDirSearch.toLowerCase().trim();
                    list = list.filter(
                      (s) =>
                        s.studentId?.toLowerCase().includes(q) ||
                        s.fullName?.toLowerCase().includes(q) ||
                        s.email?.toLowerCase().includes(q) ||
                        s.department?.toLowerCase().includes(q)
                    );
                  }

                  if (list.length === 0) {
                    return (
                      <div className="p-12 text-center text-slate-400">
                        <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <h3 className="text-sm font-bold text-slate-700">No Students Found</h3>
                        <p className="text-xs text-slate-500 mt-1">No student profiles match your search criteria.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="px-4 py-2.5">Student ID</th>
                            <th className="px-4 py-2.5">Full Name & Email</th>
                            <th className="px-4 py-2.5">Department</th>
                            <th className="px-4 py-2.5">Course & Section</th>
                            <th className="px-4 py-2.5">Authorized Laboratories</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {list.map((s) => (
                            <tr key={s.id || s.userId} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold font-mono text-blue-600">{s.studentId}</td>
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-800">{s.fullName}</div>
                                <div className="text-[10px] text-slate-400">{s.email}</div>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">{s.department || 'General'}</td>
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-slate-700">{s.course} • Sec {s.section}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {s.assignedLabs && s.assignedLabs.length > 0 ? (
                                    s.assignedLabs.map((l: string) => (
                                      <span key={l} className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                        {l}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">None</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentForEnroll(s);
                                    openDirectEnrollModal();
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Enroll</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* MODAL 1: REVIEW ENROLLMENT REQUEST */}
            {reviewModalOpen && reviewingRequest && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${reviewAction === 'APPROVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {reviewAction === 'APPROVE' ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {reviewAction === 'APPROVE' ? 'Approve Enrollment Request' : 'Reject Enrollment Request'}
                        </h3>
                        <p className="text-xs text-slate-500">Administrative policy review & authorization</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary card */}
                  <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Candidate Student:</span>
                      <strong className="text-slate-900 font-bold">{reviewingRequest.studentName} ({reviewingRequest.studentId})</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target Offering:</span>
                      <span className="text-slate-800 font-semibold">{reviewingRequest.className} ({reviewingRequest.courseCode} Sec {reviewingRequest.section})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Requested By:</span>
                      <span className="text-slate-800 font-medium">{reviewingRequest.requestedByUserName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Submitted:</span>
                      <span className="text-slate-600 font-mono text-[11px]">
                        {new Date(reviewingRequest.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {reviewAction === 'APPROVE' && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                      <span>
                        Approving this request will immediately enroll <strong>{reviewingRequest.studentName}</strong> into <strong>{reviewingRequest.className}</strong> and automatically grant workstation access to the default laboratory facility.
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
                    {/* Action toggle */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Administrative Decision:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewAction('APPROVE');
                            setReviewNotesInput('Approved by Administrator');
                          }}
                          className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            reviewAction === 'APPROVE'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Approve & Authorize</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewAction('REJECT');
                            setReviewNotesInput('Rejected by Administrator');
                          }}
                          className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            reviewAction === 'REJECT'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <UserX className="w-4 h-4" />
                          <span>Reject Request</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Reviewer Notes & Justification <span className="text-slate-400 font-normal">(Audit log record)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={reviewNotesInput}
                        onChange={(e) => setReviewNotesInput(e.target.value)}
                        placeholder="e.g. Approved for Semester 2 Systems Lab"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setReviewModalOpen(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={reviewSubmitting}
                        className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          reviewAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                      >
                        {reviewSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Confirm {reviewAction === 'APPROVE' ? 'Approval' : 'Rejection'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 2: DIRECT STUDENT ENROLLMENT INTO CLASS */}
            {directEnrollModalOpen && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Enroll Student into Class</h3>
                        <p className="text-xs text-slate-500">Direct student enrollment with automatic lab credential allocation</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDirectEnrollModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {enrollError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{enrollError}</span>
                    </div>
                  )}

                  {enrollSuccess && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{enrollSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleDirectEnrollSubmit} className="mt-4 space-y-4">
                    {/* Step 1: Target Class Offering */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Target Class Offering <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={enrollTargetClassId}
                        onChange={(e) => setEnrollTargetClassId(e.target.value)}
                        required
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      >
                        <option value="">Select target class offering...</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.courseCode} - {c.name} (Sec {c.section} • Lab {c.defaultLabCode || 'None'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Step 2: Search Student */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Search Existing Student <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={studentSearchQuery}
                          onChange={(e) => searchStudentsForEnroll(e.target.value)}
                          placeholder="Type Student ID, Roll No, Name, or Email..."
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 font-medium"
                        />
                        {searchingStudents && (
                          <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-3 top-2.5" />
                        )}
                      </div>

                      {/* Search Results Dropdown */}
                      {studentSearchResults.length > 0 && (
                        <div className="mt-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-lg divide-y divide-slate-100">
                          {studentSearchResults.map((st) => (
                            <button
                              key={st.id || st.userId}
                              type="button"
                              onClick={() => {
                                setSelectedStudentForEnroll(st);
                                setStudentSearchResults([]);
                                setStudentSearchQuery(`${st.fullName} (${st.studentId})`);
                              }}
                              className="w-full text-left p-2 hover:bg-blue-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{st.fullName}</span>
                                <span className="text-slate-400 text-[10px] ml-1.5 font-mono">{st.studentId}</span>
                                <div className="text-[10px] text-slate-500">{st.email} • {st.department}</div>
                              </div>
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                Select
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Student Card */}
                    {selectedStudentForEnroll && (
                      <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-blue-700 font-bold">Selected Candidate</span>
                          <span className="font-mono font-bold text-blue-800">{selectedStudentForEnroll.studentId}</span>
                        </div>
                        <div className="font-bold text-slate-900 text-sm">{selectedStudentForEnroll.fullName}</div>
                        <div className="text-[11px] text-slate-600">{selectedStudentForEnroll.email} • {selectedStudentForEnroll.department}</div>
                        <div className="text-[10px] text-slate-500 pt-1 border-t border-blue-200/60 flex items-center gap-1">
                          <span>Current Assigned Labs:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {selectedStudentForEnroll.assignedLabs?.join(', ') || 'None'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Administrative Notes */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Enrollment Notes <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={enrollNotesInput}
                        onChange={(e) => setEnrollNotesInput(e.target.value)}
                        placeholder="e.g. Administrative lab quota override"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setDirectEnrollModalOpen(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={enrollSubmitting || !selectedStudentForEnroll || !enrollTargetClassId}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        {enrollSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Confirm Enrollment</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'audit' && (
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tamper-Resistant Institutional Audit Trail</h3>
                <p className="text-xs text-slate-500">Immutable ledger tracking system access, workstation events, and academic actions</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'EntityId'];
                    const rows = auditLogs.map((l) => [
                      new Date(l.timestamp).toISOString(),
                      `"${l.actorName.replace(/"/g, '""')}"`,
                      l.role,
                      l.action,
                      l.entityType,
                      l.entityId
                    ]);
                    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `labguard_audit_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                  }}
                  className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title="Export Audit Trail to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center gap-3 text-xs">
              <div className="flex-1 min-w-[200px] relative">
                <input
                  type="text"
                  placeholder="Search by actor, action, or entity..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />
                {auditSearch && (
                  <button
                    onClick={() => setAuditSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-500 font-semibold">Role:</span>
                <select
                  value={auditRoleFilter}
                  onChange={(e) => setAuditRoleFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="FACULTY">FACULTY</option>
                  <option value="LAB_ASSISTANT">LAB_ASSISTANT</option>
                  <option value="STUDENT">STUDENT</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-500 font-semibold">Entity:</span>
                <select
                  value={auditEntityFilter}
                  onChange={(e) => setAuditEntityFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                >
                  <option value="ALL">All Entities</option>
                  <option value="USER">User</option>
                  <option value="LAB">Laboratory</option>
                  <option value="COMPUTER">Computer</option>
                  <option value="EQUIPMENT">Equipment</option>
                  <option value="SESSION">Session</option>
                  <option value="ISSUE">Issue</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>

              <span className="text-slate-400 font-medium ml-auto">
                Showing {
                  auditLogs.filter((log) => {
                    if (auditRoleFilter !== 'ALL' && log.role !== auditRoleFilter) return false;
                    if (auditEntityFilter !== 'ALL' && log.entityType?.toUpperCase() !== auditEntityFilter) return false;
                    if (auditSearch) {
                      const q = auditSearch.toLowerCase();
                      const matches =
                        log.actorName?.toLowerCase().includes(q) ||
                        log.action?.toLowerCase().includes(q) ||
                        log.entityType?.toLowerCase().includes(q) ||
                        log.entityId?.toLowerCase().includes(q);
                      if (!matches) return false;
                    }
                    return true;
                  }).length
                } of {auditLogs.length} entries
              </span>
            </div>

            {/* Audit Log Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity Type</th>
                    <th className="px-4 py-3">Entity ID / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.filter((log) => {
                    if (auditRoleFilter !== 'ALL' && log.role !== auditRoleFilter) return false;
                    if (auditEntityFilter !== 'ALL' && log.entityType?.toUpperCase() !== auditEntityFilter) return false;
                    if (auditSearch) {
                      const q = auditSearch.toLowerCase();
                      const matches =
                        log.actorName?.toLowerCase().includes(q) ||
                        log.action?.toLowerCase().includes(q) ||
                        log.entityType?.toLowerCase().includes(q) ||
                        log.entityId?.toLowerCase().includes(q);
                      if (!matches) return false;
                    }
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No audit records match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    auditLogs
                      .filter((log) => {
                        if (auditRoleFilter !== 'ALL' && log.role !== auditRoleFilter) return false;
                        if (auditEntityFilter !== 'ALL' && log.entityType?.toUpperCase() !== auditEntityFilter) return false;
                        if (auditSearch) {
                          const q = auditSearch.toLowerCase();
                          const matches =
                            log.actorName?.toLowerCase().includes(q) ||
                            log.action?.toLowerCase().includes(q) ||
                            log.entityType?.toLowerCase().includes(q) ||
                            log.entityId?.toLowerCase().includes(q);
                          if (!matches) return false;
                        }
                        return true;
                      })
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{log.actorName}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              log.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : log.role === 'FACULTY'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : log.role === 'LAB_ASSISTANT'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {log.role}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">{log.action}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-600">{log.entityType}</td>
                          <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px] truncate max-w-xs" title={log.entityId}>
                            {log.entityId || '—'}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Workstation & Database Configuration</h3>
              <p className="text-xs text-slate-500">Live workstation identity, Supabase synchronization, and local vault status</p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assigned Laboratory</label>
                  <input
                    type="text"
                    readOnly
                    value={pcIdentity?.is_registered && pcIdentity?.lab_code && pcIdentity.lab_code !== 'UNASSIGNED' ? pcIdentity.lab_code : 'UNASSIGNED'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">System / PC Number</label>
                  <input
                    type="text"
                    readOnly
                    value={pcIdentity?.is_registered && pcIdentity?.pc_code && pcIdentity.pc_code !== 'UNASSIGNED' ? pcIdentity.pc_code : 'UNASSIGNED'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-blue-700 font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Client Terminal ID</label>
                <input
                  type="text"
                  readOnly
                  value={pcIdentity?.client_id || 'CLIENT-UNKNOWN'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Supabase Cloud Database
                  </div>
                  <div className="text-[11px] text-blue-700 mt-0.5">
                    Two-way synchronized • Zero data loss protection active
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-bold">
                  CONNECTED
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Local Database Path</label>
                <input
                  type="text"
                  readOnly
                  value="C:\ProgramData\LABGUARD\database\labguard.db"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

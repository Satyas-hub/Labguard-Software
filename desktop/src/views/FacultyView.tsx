import React, { useState, useEffect } from 'react';
import { ApiClient } from '../services/api';
import { realtimeClient, useLiveLabMonitoring } from '../services/realtime';
import { ReportingCenter } from '../components/ReportingCenter';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import {
  Users,
  BookOpen,
  Building2,
  AlertCircle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Monitor,
  Activity,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  Filter,
  Check,
  X,
  FileText,
  User,
  ExternalLink,
  Laptop,
  BarChart3
} from 'lucide-react';

export const FacultyView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'classes' | 'students' | 'labs' | 'live' | 'sessions' | 'enroll' | 'issues' | 'reports' | 'analytics' | 'profile'
  >('dashboard');

  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [computers, setComputers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [enrollmentRequests, setEnrollmentRequests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedLiveLab, setSelectedLiveLab] = useState('ALL');

  // Class Roster Modal
  const [rosterModalClass, setRosterModalClass] = useState<any | null>(null);
  const [rosterStudents, setRosterStudents] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Enrollment Workspace State
  const [enrollMode, setEnrollMode] = useState<'existing' | 'new'>('existing');
  const [existingStudentSearch, setExistingStudentSearch] = useState('');
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState<any | null>(null);
  const [targetClassForEnroll, setTargetClassForEnroll] = useState('');
  const [enrollNotes, setEnrollNotes] = useState('');

  // Create New Student Form Data
  const [newStudentData, setNewStudentData] = useState({
    studentId: '',
    fullName: '',
    dateOfBirth: '2005-01-15',
    gender: 'Male',
    email: '',
    phone: '',
    department: 'Computer Science & Engineering',
    course: 'BTECH-CSE',
    yearOfStudy: 3,
    semester: 5,
    section: 'A',
    academicYear: '2025-2026',
    authorizedLabs: ['LAB-01'],
    password: 'Student@123',
    classId: ''
  });

  const [enrollSuccessMsg, setEnrollSuccessMsg] = useState<string | null>(null);
  const [enrollErrorMsg, setEnrollErrorMsg] = useState<string | null>(null);

  // Load all data
  const loadFacultyData = async () => {
    setLoading(true);
    try {
      const [dashRes, classesRes, studentsRes, labsRes, pcsRes, sessRes, issuesRes, reqsRes] =
        await Promise.all([
          ApiClient.request('/faculty/dashboard'),
          ApiClient.request('/classes'),
          ApiClient.request('/students'),
          ApiClient.request('/labs'),
          ApiClient.request('/computers'),
          ApiClient.request('/sessions'),
          ApiClient.request('/issues'),
          ApiClient.request('/enrollment-requests')
        ]);

      if (dashRes.success && dashRes.data) setDashboardData(dashRes.data);
      if (classesRes.success && classesRes.data) {
        setClasses(classesRes.data);
        if (!targetClassForEnroll && classesRes.data.length > 0) {
          setTargetClassForEnroll(classesRes.data[0].id);
        }
      }
      if (studentsRes.success && studentsRes.data) setStudents(studentsRes.data);
      if (labsRes.success && labsRes.data) {
        setLabs(labsRes.data);
        if (selectedLiveLab === 'ALL' && labsRes.data.length > 0) {
          setSelectedLiveLab(labsRes.data[0].code);
        }
      }
      if (pcsRes.success && pcsRes.data) setComputers(pcsRes.data);
      if (sessRes.success && sessRes.data) setSessions(sessRes.data);
      if (issuesRes.success && issuesRes.data) setIssues(issuesRes.data);
      if (reqsRes.success && reqsRes.data) setEnrollmentRequests(reqsRes.data);
    } catch (err) {
      console.error('Failed to load faculty data:', err);
    } finally {
      setLoading(false);
    }
  };

  const { isLiveConnected } = useLiveLabMonitoring(selectedLiveLab);

  useEffect(() => {
    loadFacultyData();
  }, [activeTab]);

  // Real-time live workstation state updater
  useEffect(() => {
    const unbindPc = realtimeClient.on('WORKSTATION_STATE_CHANGED', (payload) => {
      setComputers((prev) =>
        prev.map((c) => {
          if (c.id === payload.id || (c.pcCode === payload.pcCode && c.labCode === payload.labCode)) {
            return {
              ...c,
              state: payload.state,
              isOnline: payload.isOnline !== undefined ? payload.isOnline : c.isOnline,
              activeStudentName: payload.activeStudentName,
              activeSessionId: payload.activeSessionId
            };
          }
          return c;
        })
      );
    });

    const unbindStart = realtimeClient.on('SESSION_STARTED', (session) => {
      setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
      setComputers((prev) =>
        prev.map((c) => {
          if (c.pcCode === session.pcCode && c.labCode === session.labCode) {
            return {
              ...c,
              state: 'IN_USE',
              activeStudentName: session.studentName,
              activeSessionId: session.id
            };
          }
          return c;
        })
      );
    });

    const unbindEnd = realtimeClient.on('SESSION_ENDED', (session) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, status: session.status || 'COMPLETED', endedAt: session.endedAt } : s))
      );
      setComputers((prev) =>
        prev.map((c) => {
          if (c.pcCode === session.pcCode && c.labCode === session.labCode) {
            return {
              ...c,
              state: 'AVAILABLE',
              activeStudentName: undefined,
              activeSessionId: undefined
            };
          }
          return c;
        })
      );
    });

    return () => {
      unbindPc();
      unbindStart();
      unbindEnd();
    };
  }, []);

  // Load roster modal
  const openClassRoster = async (cls: any) => {
    setRosterModalClass(cls);
    setRosterLoading(true);
    try {
      const res = await ApiClient.request(`/classes/${cls.id}/students`);
      if (res.success && res.data) {
        setRosterStudents(res.data);
      } else {
        // Fallback to filtering students by class code and section
        const matched = students.filter(
          (s) => s.course === cls.courseCode && s.section?.toUpperCase() === cls.section?.toUpperCase()
        );
        setRosterStudents(matched);
      }
    } catch (e) {
      setRosterStudents([]);
    } finally {
      setRosterLoading(false);
    }
  };

  // Handle Enroll Existing Student
  const handleEnrollExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollErrorMsg(null);
    setEnrollSuccessMsg(null);

    if (!selectedStudentForEnroll) {
      setEnrollErrorMsg('Please search and select a student to enroll');
      return;
    }

    if (!targetClassForEnroll) {
      setEnrollErrorMsg('Please select a target class offering');
      return;
    }

    const res = await ApiClient.request(`/classes/${targetClassForEnroll}/enroll`, {
      method: 'POST',
      body: JSON.stringify({
        studentId: selectedStudentForEnroll.studentId,
        notes: enrollNotes
      })
    });

    if (res.success) {
      const isPending = (res as any).status === 'PENDING_APPROVAL' || res.data?.status === 'PENDING';
      setEnrollSuccessMsg(
        isPending
          ? 'Enrollment request successfully generated and submitted for Administrator approval.'
          : `Student ${selectedStudentForEnroll.fullName} (${selectedStudentForEnroll.studentId}) successfully enrolled!`
      );
      setSelectedStudentForEnroll(null);
      setExistingStudentSearch('');
      setEnrollNotes('');
      loadFacultyData();
    } else {
      setEnrollErrorMsg(res.message || 'Enrollment failed');
    }
  };

  // Handle Create New Student
  const handleCreateNewStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollErrorMsg(null);
    setEnrollSuccessMsg(null);

    const res = await ApiClient.request('/students/enroll', {
      method: 'POST',
      body: JSON.stringify(newStudentData)
    });

    if (res.success) {
      setEnrollSuccessMsg(
        `New student ${newStudentData.fullName} (${newStudentData.studentId}) created and authorized!`
      );
      setNewStudentData({
        ...newStudentData,
        studentId: '',
        fullName: '',
        email: '',
        phone: ''
      });
      loadFacultyData();
    } else {
      setEnrollErrorMsg(res.message || 'Failed to create student');
    }
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    const term = search.toLowerCase();
    const matchesSearch =
      s.studentId?.toLowerCase().includes(term) ||
      s.fullName?.toLowerCase().includes(term) ||
      s.email?.toLowerCase().includes(term);

    const matchesClass =
      selectedClassFilter === 'ALL' ||
      classes.find((c) => c.id === selectedClassFilter && c.courseCode === s.course && c.section === s.section);

    return matchesSearch && matchesClass;
  });

  // Filter existing students search
  const matchedExistingStudents = existingStudentSearch.trim()
    ? students.filter(
        (s) =>
          s.studentId?.toLowerCase().includes(existingStudentSearch.toLowerCase()) ||
          s.fullName?.toLowerCase().includes(existingStudentSearch.toLowerCase()) ||
          s.email?.toLowerCase().includes(existingStudentSearch.toLowerCase())
      )
    : [];

  const targetClassObj = classes.find((c) => c.id === targetClassForEnroll);

  // Live Lab computers
  const liveComputers = computers.filter(
    (c) => selectedLiveLab === 'ALL' || c.labCode?.toUpperCase() === selectedLiveLab.toUpperCase()
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Faculty Academic Command</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                  Faculty Portal
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {dashboardData?.faculty?.fullName || 'Dr. Sarah Jenkins (Faculty)'} •{' '}
                {dashboardData?.faculty?.department || 'Computer Science & Engineering'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('enroll')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enroll Student</span>
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Live Lab Monitor</span>
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex space-x-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Sparkles },
            { id: 'classes', label: 'My Classes', icon: BookOpen, badge: classes.length },
            { id: 'students', label: 'Students Roster', icon: Users, badge: students.length },
            { id: 'labs', label: 'My Laboratories', icon: Building2, badge: labs.length },
            { id: 'live', label: 'Live Lab Monitor', icon: Monitor },
            { id: 'sessions', label: 'Session History', icon: Clock },
            { id: 'enroll', label: 'Enrollment Workspace', icon: Plus },
            { id: 'issues', label: 'Lab Issues', icon: AlertCircle, badge: issues.length },
            { id: 'reports', label: 'Reporting & Exports', icon: FileText },
            { id: 'analytics', label: 'Fleet Analytics', icon: BarChart3 },
            { id: 'profile', label: 'Profile', icon: User }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 cursor-pointer transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ==================================================================== */}
        {/* 1. DASHBOARD OVERVIEW TAB                                            */}
        {/* ==================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Classes</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{classes.length}</p>
                  <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Active Academic Cohorts</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enrolled Students</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{students.length}</p>
                  <p className="text-[11px] text-indigo-600 font-medium mt-0.5">Across All Courses</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Labs</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{labs.length}</p>
                  <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Physical Facilities</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Sessions</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {sessions.filter((s) => s.status === 'ACTIVE').length}
                  </p>
                  <p className="text-[11px] text-blue-600 font-medium mt-0.5">Workstations In Use</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Recent Live Sessions & Classes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Classes Quick View */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>My Assigned Classes &amp; Cohorts</span>
                  </h2>
                  <button
                    onClick={() => setActiveTab('classes')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-3.5 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/20 transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">{cls.name}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700">
                            {cls.subjectCode}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              cls.enrollmentPolicy === 'APPROVAL_REQUIRED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {cls.enrollmentPolicy || 'DIRECT'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {cls.courseCode} • Sem {cls.semester} • Section {cls.section} • Facility:{' '}
                          <span className="font-semibold text-slate-700">{cls.defaultLabCode || 'LAB-01'}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-slate-700">
                          {cls.enrolledCount || 0} / {cls.capacity || 40} Students
                        </span>
                        <button
                          onClick={() => openClassRoster(cls)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                        >
                          Roster
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Requests & Alerts Widget */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <span>Enrollment Requests</span>
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                      {enrollmentRequests.filter((r) => r.status === 'PENDING').length} Pending
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {enrollmentRequests.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                        No enrollment requests submitted yet.
                      </div>
                    ) : (
                      enrollmentRequests.slice(0, 4).map((req) => (
                        <div key={req.id} className="p-2.5 border border-slate-100 bg-slate-50/60 rounded-lg text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{req.studentName}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                req.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : req.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {req.className} ({req.courseCode})
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => setActiveTab('enroll')}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer text-center"
                  >
                    Open Enrollment Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 2. MY CLASSES & ROSTERS TAB                                          */}
        {/* ==================================================================== */}
        {activeTab === 'classes' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Academic Classes &amp; Cohorts</h2>
                <p className="text-xs text-slate-500">
                  Course offerings, subjects, assigned laboratories, and enrollment capacity
                </p>
              </div>
              <button
                onClick={() => setActiveTab('enroll')}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Enroll Student</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {cls.subjectCode}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1.5">{cls.name}</h3>
                      <p className="text-xs text-slate-500">{cls.subjectName}</p>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        cls.enrollmentPolicy === 'APPROVAL_REQUIRED'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      Policy: {cls.enrollmentPolicy || 'DIRECT'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">Course</span>
                      <p className="font-semibold text-slate-800">{cls.courseCode}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">Academic Term</span>
                      <p className="font-semibold text-slate-800">
                        Sem {cls.semester} ({cls.section})
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">Facility</span>
                      <p className="font-semibold text-slate-800">{cls.defaultLabCode || 'LAB-01'}</p>
                    </div>
                  </div>

                  {/* Enrollment Progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500">Class Roster Fill</span>
                      <span className="font-bold text-slate-800">
                        {cls.enrolledCount || 0} / {cls.capacity || 40} Students
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(((cls.enrolledCount || 0) / (cls.capacity || 40)) * 100)
                          )}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Instructor: {cls.assignedFacultyName}</span>
                    <button
                      onClick={() => openClassRoster(cls)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      View Student Roster
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 3. STUDENTS ROSTER TAB                                               */}
        {/* ==================================================================== */}
        {activeTab === 'students' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Enrolled Student Directory</h2>
                <p className="text-xs text-slate-500">
                  Comprehensive roster of academic students authorized across your courses
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="ALL">All Assigned Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, name, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-64 focus:outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Student Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Course / Year</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Authorized Labs</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No students match the current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id || s.studentId} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-bold text-slate-900">{s.studentId}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{s.fullName}</p>
                          <p className="text-[11px] text-slate-400">{s.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{s.department}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.course} • Year {s.yearOfStudy}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">Sec {s.section}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(s.assignedLabs || ['LAB-01']).map((lab: string) => (
                              <span
                                key={lab}
                                className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded"
                              >
                                {lab}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center text-emerald-600 font-semibold">
                            <Check className="w-3 h-3 mr-1" /> Active
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. MY LABORATORIES TAB                                               */}
        {/* ==================================================================== */}
        {activeTab === 'labs' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Assigned Laboratory Facilities</h2>
              <p className="text-xs text-slate-500">
                Authorized computing centers and workstation fleets assigned to your curriculum
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {labs.map((lab) => (
                <div key={lab.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {lab.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        lab.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {lab.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-2">{lab.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lab.building || 'Science Complex'} • Room {lab.room}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Capacity</span>
                      <p className="font-bold text-slate-800 text-sm">{lab.capacity}</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Total PCs</span>
                      <p className="font-bold text-slate-800 text-sm">{lab.pcCount || 0}</p>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <span className="text-[10px] text-emerald-600 font-semibold uppercase">Available</span>
                      <p className="font-bold text-emerald-800 text-sm">{lab.metrics?.availablePcs ?? lab.pcCount}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedLiveLab(lab.code);
                        setActiveTab('live');
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Live Monitor</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 5. LIVE LAB MONITOR TAB                                              */}
        {/* ==================================================================== */}
        {activeTab === 'live' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <span>Real-Time Workstation Fleet Status</span>
                </h2>
                <p className="text-xs text-slate-500">Live active sessions and telemetry from client terminals</p>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  isLiveConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{isLiveConnected ? 'Live Gateway Active' : 'Offline / Polling'}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-500">Facility:</span>
                  <select
                    value={selectedLiveLab}
                    onChange={(e) => setSelectedLiveLab(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="ALL">All Facilities</option>
                    {labs.map((l) => (
                      <option key={l.id} value={l.code}>
                        {l.code} ({l.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Workstations Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {liveComputers.map((pc) => {
                const isOnline = pc.isOnline;
                const state = pc.state || 'AVAILABLE';

                let stateBadge = (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                    Available
                  </span>
                );
                if (state === 'IN_USE') {
                  stateBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
                      In Use
                    </span>
                  );
                } else if (state === 'MAINTENANCE') {
                  stateBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                      Maintenance
                    </span>
                  );
                } else if (state === 'DISABLED') {
                  stateBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800">
                      Disabled
                    </span>
                  );
                }

                return (
                  <div
                    key={pc.id}
                    className={`bg-white border rounded-xl p-4 shadow-xs transition-all ${
                      state === 'IN_USE'
                        ? 'border-blue-300 ring-1 ring-blue-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Monitor
                          className={`w-4 h-4 ${
                            state === 'IN_USE'
                              ? 'text-blue-600'
                              : state === 'AVAILABLE'
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="font-bold text-xs text-slate-900">{pc.pcCode}</span>
                      </div>
                      {stateBadge}
                    </div>

                    <div className="mt-3">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Laboratory</span>
                      <p className="text-xs font-semibold text-slate-700">{pc.labCode}</p>
                    </div>

                    {state === 'IN_USE' && (
                      <div className="mt-3 p-2 bg-blue-50/60 rounded-lg border border-blue-100">
                        <span className="text-[10px] text-blue-600 font-bold uppercase">Active Student</span>
                        <p className="text-xs font-bold text-blue-950 truncate">
                          {pc.activeStudentName || 'Active Session'}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Host: {pc.hostname || 'LAB-HOST'}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 6. SESSIONS HISTORY TAB                                              */}
        {/* ==================================================================== */}
        {activeTab === 'sessions' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lab Session Logs</h2>
              <p className="text-xs text-slate-500">
                Audited student login sessions across authorized computing workstations
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Roll Number</th>
                    <th className="px-4 py-3">Facility</th>
                    <th className="px-4 py-3">Workstation</th>
                    <th className="px-4 py-3">Start Time</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No session records logged.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{s.studentName || 'Student'}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{s.studentIdentifier}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{s.labCode}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{s.pcCode}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(s.startedAt).toLocaleTimeString()} ({new Date(s.startedAt).toLocaleDateString()})
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 7. STUDENT ENROLLMENT WORKSPACE TAB                                  */}
        {/* ==================================================================== */}
        {activeTab === 'enroll' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Student Enrollment Workspace</h2>
                  <p className="text-xs text-slate-500">
                    Dual-mode academic onboarding: Link existing campus students or create new profiles
                  </p>
                </div>

                {/* Mode Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setEnrollMode('existing')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      enrollMode === 'existing'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Enroll Existing Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollMode('new')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      enrollMode === 'new'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Create &amp; Enroll New
                  </button>
                </div>
              </div>

              {/* Alert Messages */}
              {enrollSuccessMsg && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{enrollSuccessMsg}</span>
                </div>
              )}

              {enrollErrorMsg && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{enrollErrorMsg}</span>
                </div>
              )}

              {/* MODE 1: ENROLL EXISTING STUDENT */}
              {enrollMode === 'existing' && (
                <form onSubmit={handleEnrollExistingSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. Search Campus Student Roster
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by Roll No, Student Name, or Email..."
                        value={existingStudentSearch}
                        onChange={(e) => setExistingStudentSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {matchedExistingStudents.length > 0 && !selectedStudentForEnroll && (
                      <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white shadow-sm">
                        {matchedExistingStudents.map((st) => (
                          <div
                            key={st.id || st.studentId}
                            onClick={() => {
                              setSelectedStudentForEnroll(st);
                              setExistingStudentSearch(`${st.fullName} (${st.studentId})`);
                            }}
                            className="p-2.5 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{st.fullName}</p>
                              <p className="text-[11px] text-slate-500">
                                {st.studentId} • {st.department} • {st.course}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-blue-600">Select</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Student Card Preview */}
                  {selectedStudentForEnroll && (
                    <div className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                          {selectedStudentForEnroll.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900">
                              {selectedStudentForEnroll.fullName}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                              {selectedStudentForEnroll.studentId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {selectedStudentForEnroll.email} • {selectedStudentForEnroll.department} •{' '}
                            {selectedStudentForEnroll.course}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForEnroll(null);
                          setExistingStudentSearch('');
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Target Class Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      2. Select Target Class Offering
                    </label>
                    <select
                      value={targetClassForEnroll}
                      onChange={(e) => setTargetClassForEnroll(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-white"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({cls.subjectCode}) • Policy: {cls.enrollmentPolicy || 'DIRECT'} • Facility:{' '}
                          {cls.defaultLabCode || 'LAB-01'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Policy Preview Card */}
                  {targetClassObj && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${
                        targetClassObj.enrollmentPolicy === 'APPROVAL_REQUIRED'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs">
                          {targetClassObj.enrollmentPolicy === 'APPROVAL_REQUIRED'
                            ? 'Administrator Approval Required'
                            : 'Direct Instant Enrollment'}
                        </p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          {targetClassObj.enrollmentPolicy === 'APPROVAL_REQUIRED'
                            ? 'This class policy requires institutional administrator review before lab workstation access is granted.'
                            : 'This class allows direct faculty authorization. Workstation credentials and laboratory access will be provisioned immediately.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enrollment Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Approved for semester project practical sessions"
                      value={enrollNotes}
                      onChange={(e) => setEnrollNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      Confirm &amp; Enroll Student
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 2: CREATE & ENROLL NEW STUDENT */}
              {enrollMode === 'new' && (
                <form onSubmit={handleCreateNewStudentSubmit} className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">
                      1. Personal Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Student ID / Roll Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={newStudentData.studentId}
                          onChange={(e) => setNewStudentData({ ...newStudentData, studentId: e.target.value })}
                          placeholder="e.g. STU-2026-999"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Full Legal Name *</label>
                        <input
                          type="text"
                          required
                          value={newStudentData.fullName}
                          onChange={(e) => setNewStudentData({ ...newStudentData, fullName: e.target.value })}
                          placeholder="e.g. Marcus Vance"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Institutional Email *</label>
                        <input
                          type="email"
                          required
                          value={newStudentData.email}
                          onChange={(e) => setNewStudentData({ ...newStudentData, email: e.target.value })}
                          placeholder="m.vance@labguard.edu"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={newStudentData.phone}
                          onChange={(e) => setNewStudentData({ ...newStudentData, phone: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">
                      2. Academic Placement
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                        <input
                          type="text"
                          value={newStudentData.department}
                          onChange={(e) => setNewStudentData({ ...newStudentData, department: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
                        <input
                          type="text"
                          value={newStudentData.course}
                          onChange={(e) => setNewStudentData({ ...newStudentData, course: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Section</label>
                        <input
                          type="text"
                          value={newStudentData.section}
                          onChange={(e) => setNewStudentData({ ...newStudentData, section: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      Create &amp; Authorize Student
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Requests Queue */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Submitted Enrollment Requests</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Student Roll No</th>
                      <th className="px-3 py-2">Student Name</th>
                      <th className="px-3 py-2">Target Class</th>
                      <th className="px-3 py-2">Policy</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Review Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrollmentRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                          No requests submitted.
                        </td>
                      </tr>
                    ) : (
                      enrollmentRequests.map((req) => (
                        <tr key={req.id}>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">{req.studentId}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{req.studentName}</td>
                          <td className="px-3 py-2 text-slate-600">{req.className}</td>
                          <td className="px-3 py-2 text-slate-500">{req.policy}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                req.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : req.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-[11px]">{req.reviewNotes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 8. LAB ISSUES TAB                                                    */}
        {/* ==================================================================== */}
        {activeTab === 'issues' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reported Hardware &amp; Lab Issues</h2>
              <p className="text-xs text-slate-500">
                Malfunctions, peripheral disconnections, and maintenance tickets across your assigned labs
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Facility</th>
                    <th className="px-4 py-3">Workstation</th>
                    <th className="px-4 py-3">Issue Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Reported By</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No issues currently reported in your facilities.
                      </td>
                    </tr>
                  ) : (
                    issues.map((iss) => (
                      <tr key={iss.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{iss.labCode}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{iss.pcCode}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{iss.issueType}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{iss.description}</td>
                        <td className="px-4 py-3 text-slate-500">{iss.reporterName || 'Student'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              iss.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : iss.status === 'OPEN'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {iss.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 9. REPORTING & EXPORTS TAB                                           */}
        {/* ==================================================================== */}
        {activeTab === 'reports' && (
          <ReportingCenter defaultLab={selectedLiveLab} />
        )}

        {/* ==================================================================== */}
        {/* 10. FLEET ANALYTICS TAB                                              */}
        {/* ==================================================================== */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard defaultLab={selectedLiveLab} />
        )}

        {/* ==================================================================== */}
        {/* 11. FACULTY PROFILE TAB                                              */}
        {/* ==================================================================== */}
        {activeTab === 'profile' && (
          <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            <div className="flex items-center space-x-4 border-b border-slate-100 pb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                {(dashboardData?.faculty?.fullName || 'Dr. Sarah Jenkins').charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {dashboardData?.faculty?.fullName || 'Dr. Sarah Jenkins'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {dashboardData?.faculty?.department || 'Department of Computer Science & Engineering'}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700">
                  Institutional Faculty Role
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Email Address</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {dashboardData?.faculty?.email || 'faculty@labguard.edu'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Employee ID</span>
                <p className="font-semibold text-slate-800 mt-0.5">EMP-FAC-002</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Primary Department</span>
                <p className="font-semibold text-slate-800 mt-0.5">Computer Science &amp; Engineering</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Active Classes</span>
                <p className="font-semibold text-slate-800 mt-0.5">{classes.length} Courses</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CLASS ROSTER MODAL */}
      {rosterModalClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Class Roster: {rosterModalClass.name}</h3>
                <p className="text-xs text-slate-500">
                  {rosterModalClass.courseCode} • {rosterModalClass.subjectCode} • Section {rosterModalClass.section}
                </p>
              </div>
              <button
                onClick={() => setRosterModalClass(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {rosterLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading student roster...</div>
              ) : rosterStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No students enrolled in this class offering yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2">Student Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rosterStudents.map((st) => (
                      <tr key={st.id || st.studentId}>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">{st.studentId}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{st.fullName}</td>
                        <td className="px-3 py-2 text-slate-500">{st.email}</td>
                        <td className="px-3 py-2 font-semibold text-slate-700">Sec {st.section}</td>
                        <td className="px-3 py-2">
                          <span className="text-emerald-600 font-semibold text-[11px]">Enrolled ✓</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setRosterModalClass(null)}
                className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

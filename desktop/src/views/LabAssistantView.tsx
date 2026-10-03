import React, { useState, useEffect, useMemo } from 'react';
import { ApiClient } from '../services/api';
import { realtimeClient, useLiveLabMonitoring } from '../services/realtime';
import { ReportingCenter } from '../components/ReportingCenter';
import {
  Monitor,
  AlertTriangle,
  Wrench,
  Activity,
  CheckCircle2,
  Clock,
  User,
  Users,
  Building2,
  Search,
  Filter,
  Plus,
  RefreshCw,
  ShieldAlert,
  Check,
  X,
  ChevronRight,
  ArrowRightLeft,
  Cpu,
  HardDrive,
  Eye,
  History,
  Sparkles,
  Power,
  Shield,
  Layers,
  FileText
} from 'lucide-react';
import {
  Lab,
  Computer,
  Session,
  Issue,
  MaintenanceRecord,
  HardwareEvent,
  AssistantDashboardMetrics,
  Equipment,
  PcState,
  EquipmentType,
  EquipmentStatus
} from '../../../shared/types';

export const LabAssistantView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'occupancy' | 'sessions' | 'equipment' | 'hardware' | 'maintenance' | 'labs' | 'reports'
  >('dashboard');

  // Loading & refresh state
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Data Stores
  const [dashboardData, setDashboardData] = useState<AssistantDashboardMetrics | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [hardwareEvents, setHardwareEvents] = useState<HardwareEvent[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);

  // Filters
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>('ALL');
  const [pcStateFilter, setPcStateFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hardwareTypeFilter, setHardwareTypeFilter] = useState('ALL');
  const [unackOnly, setUnackOnly] = useState(false);
  const [maintenanceSubTab, setMaintenanceSubTab] = useState<'issues' | 'orders'>('issues');
  const [sessionsSubTab, setSessionsSubTab] = useState<'active' | 'history'>('active');

  // Modals state
  const [selectedPc, setSelectedPc] = useState<any | null>(null);
  const [sessionToEnd, setSessionToEnd] = useState<Session | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [replacingEquipment, setReplacingEquipment] = useState<Equipment | null>(null);
  const [spareEquipmentId, setSpareEquipmentId] = useState('');
  const [replacementNotes, setReplacementNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // New Maintenance Order Modal
  const [showNewMaintenanceModal, setShowNewMaintenanceModal] = useState(false);
  const [newMaintenanceData, setNewMaintenanceData] = useState({
    labId: '',
    computerId: '',
    equipmentId: '',
    issueId: '',
    actionTaken: '',
    responsibleUser: '',
    cost: 0,
    notes: ''
  });

  // Issue Update Modal
  const [selectedIssueForUpdate, setSelectedIssueForUpdate] = useState<Issue | null>(null);
  const [issueUpdateStatus, setIssueUpdateStatus] = useState<string>('INVESTIGATING');
  const [issueResolutionNotes, setIssueResolutionNotes] = useState('');

  // Manual Hardware Event Modal
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventData, setNewEventData] = useState({
    labCode: '',
    pcCode: '',
    eventType: 'HARDWARE_DISCONNECTED',
    description: ''
  });

  // Load all operational datasets
  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, labsRes, compRes, sessRes, equipRes, hweRes, issuesRes, maintRes] =
        await Promise.all([
          ApiClient.request('/assistant/dashboard'),
          ApiClient.request('/labs'),
          ApiClient.request('/computers'),
          ApiClient.request('/sessions'),
          ApiClient.request('/equipment'),
          ApiClient.request('/hardware-events'),
          ApiClient.request('/issues'),
          ApiClient.request('/maintenance')
        ]);

      if (dashRes.success && dashRes.data) setDashboardData(dashRes.data);
      if (labsRes.success && labsRes.data) {
        setLabs(labsRes.data);
        if (labsRes.data.length > 0 && !newMaintenanceData.labId) {
          setNewMaintenanceData((prev) => ({
            ...prev,
            labId: labsRes.data[0].id
          }));
          setNewEventData((prev) => ({
            ...prev,
            labCode: labsRes.data[0].code
          }));
        }
      }
      if (compRes.success && compRes.data) setComputers(compRes.data);
      if (sessRes.success && sessRes.data) setSessions(sessRes.data);
      if (equipRes.success && equipRes.data) setEquipment(equipRes.data);
      if (hweRes.success && hweRes.data) setHardwareEvents(hweRes.data);
      if (issuesRes.success && issuesRes.data) setIssues(issuesRes.data);
      if (maintRes.success && maintRes.data) setMaintenanceRecords(maintRes.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load assistant data:', err);
    } finally {
      setLoading(false);
    }
  };

  const { isLiveConnected } = useLiveLabMonitoring(selectedLabFilter);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  // Real-time live synchronization listeners
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

    const unbindHw = realtimeClient.on('HARDWARE_ALERT', (event) => {
      setHardwareEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);
    });

    const unbindIssueRep = realtimeClient.on('ISSUE_REPORTED', (issue) => {
      setIssues((prev) => [issue, ...prev.filter((i) => i.id !== issue.id)]);
    });

    const unbindIssueUpd = realtimeClient.on('ISSUE_UPDATED', (issue) => {
      setIssues((prev) => prev.map((i) => (i.id === issue.id ? issue : i)));
    });

    const unbindMaint = realtimeClient.on('MAINTENANCE_UPDATED', (record) => {
      setMaintenanceRecords((prev) => {
        const idx = prev.findIndex((m) => m.id === record.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = record;
          return updated;
        }
        return [record, ...prev];
      });
    });

    return () => {
      unbindPc();
      unbindStart();
      unbindEnd();
      unbindHw();
      unbindIssueRep();
      unbindIssueUpd();
      unbindMaint();
    };
  }, []);

  // Filtered Computers
  const filteredComputers = useMemo(() => {
    return computers.filter((c) => {
      if (selectedLabFilter !== 'ALL') {
        if (c.labId !== selectedLabFilter && c.labCode?.toUpperCase() !== selectedLabFilter.toUpperCase()) {
          return false;
        }
      }
      if (pcStateFilter !== 'ALL' && c.state !== pcStateFilter) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesCode = c.pcCode.toLowerCase().includes(q);
        const matchesClient = (c as any).clientId?.toLowerCase().includes(q);
        const matchesIp = (c as any).ipAddress?.toLowerCase().includes(q);
        if (!matchesCode && !matchesClient && !matchesIp) return false;
      }
      return true;
    });
  }, [computers, selectedLabFilter, pcStateFilter, searchQuery]);

  // Active Sessions
  const activeSessions = useMemo(() => {
    return sessions.filter((s) => s.status === 'ACTIVE');
  }, [sessions]);

  // Completed Sessions
  const completedSessions = useMemo(() => {
    return sessions.filter((s) => s.status !== 'ACTIVE');
  }, [sessions]);

  // Hardware Events Filtered
  const filteredHardwareEvents = useMemo(() => {
    return hardwareEvents.filter((e) => {
      if (unackOnly && e.acknowledged) return false;
      if (hardwareTypeFilter !== 'ALL' && e.eventType !== hardwareTypeFilter) return false;
      if (selectedLabFilter !== 'ALL') {
        if (e.labId !== selectedLabFilter && e.labCode.toUpperCase() !== selectedLabFilter.toUpperCase()) {
          return false;
        }
      }
      return true;
    });
  }, [hardwareEvents, unackOnly, hardwareTypeFilter, selectedLabFilter]);

  // Handle Workstation State Change
  const handleUpdatePcState = async (pcId: string, newState: PcState) => {
    setActionLoading(true);
    try {
      const res = await ApiClient.request(`/computers/${pcId}/state`, {
        method: 'PATCH',
        body: JSON.stringify({ state: newState })
      });
      if (res.success) {
        await loadData();
        if (selectedPc && selectedPc.id === pcId) {
          setSelectedPc((prev: any) => ({ ...prev, state: newState }));
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Safe End Session
  const handleConfirmEndSession = async () => {
    if (!sessionToEnd) return;
    setEndingSession(true);
    try {
      const res = await ApiClient.request('/sessions/end', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionToEnd.id,
          endMode: 'FORCED_END'
        })
      });
      if (res.success) {
        setSessionToEnd(null);
        if (selectedPc && selectedPc.activeSession?.id === sessionToEnd.id) {
          setSelectedPc(null);
        }
        await loadData();
      }
    } finally {
      setEndingSession(false);
    }
  };

  // Handle Hardware Event Acknowledgment
  const handleAcknowledgeEvent = async (eventId: string) => {
    const res = await ApiClient.request(`/hardware-events/${eventId}/acknowledge`, {
      method: 'PATCH'
    });
    if (res.success) {
      loadData();
    }
  };

  // Handle Manual Hardware Event Submission
  const handleCreateHardwareEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await ApiClient.request('/hardware-events', {
        method: 'POST',
        body: JSON.stringify(newEventData)
      });
      if (res.success) {
        setShowNewEventModal(false);
        setNewEventData({
          labCode: labs[0]?.code || 'LAB-01',
          pcCode: '',
          eventType: 'HARDWARE_DISCONNECTED',
          description: ''
        });
        loadData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Maintenance Order
  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await ApiClient.request('/maintenance', {
        method: 'POST',
        body: JSON.stringify(newMaintenanceData)
      });
      if (res.success) {
        setShowNewMaintenanceModal(false);
        setNewMaintenanceData({
          labId: labs[0]?.id || '',
          computerId: '',
          equipmentId: '',
          issueId: '',
          actionTaken: '',
          responsibleUser: '',
          cost: 0,
          notes: ''
        });
        loadData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Complete Maintenance Order
  const handleCompleteMaintenance = async (orderId: string) => {
    const notes = prompt('Enter repair and testing sign-off notes:') || 'Bench repair completed. Workstation tested functional.';
    const res = await ApiClient.request(`/maintenance/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'COMPLETED',
        notes
      })
    });
    if (res.success) {
      loadData();
    }
  };

  // Handle Issue Status Update
  const handleUpdateIssue = async () => {
    if (!selectedIssueForUpdate) return;
    setActionLoading(true);
    try {
      const res = await ApiClient.request(`/issues/${selectedIssueForUpdate.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: issueUpdateStatus,
          resolutionNotes: issueResolutionNotes
        })
      });
      if (res.success) {
        setSelectedIssueForUpdate(null);
        setIssueResolutionNotes('');
        loadData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Atomic Defective Equipment Replacement
  const handleReplaceEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingEquipment || !spareEquipmentId) return;
    setActionLoading(true);
    try {
      const res = await ApiClient.request(`/equipment/${replacingEquipment.id}/replace`, {
        method: 'POST',
        body: JSON.stringify({
          spareEquipmentId,
          defectNotes: replacementNotes || 'Swapped out defective peripheral with verified spare.'
        })
      });
      if (res.success) {
        setReplacingEquipment(null);
        setSpareEquipmentId('');
        setReplacementNotes('');
        loadData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Available Spares for current replacement target
  const availableSpares = useMemo(() => {
    if (!replacingEquipment) return [];
    return equipment.filter(
      (eq) =>
        eq.id !== replacingEquipment.id &&
        eq.type === replacingEquipment.type &&
        (eq.status === 'AVAILABLE' || eq.status === 'FUNCTIONAL') &&
        !eq.computerId
    );
  }, [equipment, replacingEquipment]);

  // Compute live elapsed time helper
  const getElapsedTimeString = (startedAt: string) => {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    const mins = Math.floor(diff / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) return `${hours}h ${remMins}m`;
    return `${mins}m`;
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden font-sans">
      {/* Institutional Role Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-wide">LAB ASSISTANT COMMAND CENTER</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                OPERATIONAL FLEET DESK
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Monitoring {labs.length} Assigned Laboratories • Direct Workstation Hardware & Maintenance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-slate-300 font-medium">{isLiveConnected ? 'Live Gateway Active' : 'Polling Mode'}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 text-[11px] font-mono">
              {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Primary Operational Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 pt-2 flex space-x-1 overflow-x-auto shadow-xs">
        {[
          { id: 'dashboard', label: 'Operational Dashboard', icon: Sparkles },
          { id: 'occupancy', label: 'Live Workstation Fleet', icon: Monitor, badge: dashboardData?.totalWorkstations },
          { id: 'sessions', label: "Who's In / Who's Out", icon: Users, badge: activeSessions.length, badgeColor: 'bg-blue-600' },
          { id: 'equipment', label: 'Peripherals & Equipment', icon: Layers },
          { id: 'hardware', label: 'Hardware Telemetry Events', icon: Activity, badge: dashboardData?.recentHardwareAlertsCount, badgeColor: 'bg-rose-600' },
          { id: 'maintenance', label: 'Issues & Maintenance', icon: AlertTriangle, badge: dashboardData?.openIssuesCount, badgeColor: 'bg-amber-600' },
          { id: 'labs', label: 'My Assigned Facilities', icon: Building2 },
          { id: 'reports', label: 'Facility Reports', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 cursor-pointer transition-all whitespace-nowrap ${
                isActive
                  ? 'border-amber-600 text-amber-800 bg-amber-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white ${
                    tab.badgeColor || 'bg-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ================================================================= */}
        {/* TAB 1: OPERATIONAL DASHBOARD */}
        {/* ================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Hero KPI Telemetry Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Fleet</span>
                  <Monitor className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-black text-slate-900">{dashboardData?.totalWorkstations || 0}</div>
                <span className="text-[11px] text-slate-500 font-medium">{dashboardData?.assignedLabsCount || 0} Assigned Labs</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-emerald-100 shadow-xs">
                <div className="flex items-center justify-between text-emerald-600 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Available</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600">{dashboardData?.availableWorkstations || 0}</div>
                <span className="text-[11px] text-emerald-600/80 font-medium">Ready for Students</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-blue-100 shadow-xs">
                <div className="flex items-center justify-between text-blue-600 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Active Sessions</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-blue-600">{dashboardData?.activeSessionsCount || 0}</div>
                <span className="text-[11px] text-blue-600/80 font-medium">Live Attendance</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-100 shadow-xs">
                <div className="flex items-center justify-between text-amber-600 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Maintenance</span>
                  <Wrench className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-amber-600">{dashboardData?.maintenanceWorkstations || 0}</div>
                <span className="text-[11px] text-amber-600/80 font-medium">Under Repair</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-rose-100 shadow-xs">
                <div className="flex items-center justify-between text-rose-600 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Open Issues</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-rose-600">{dashboardData?.openIssuesCount || 0}</div>
                <span className="text-[11px] text-rose-600/80 font-medium">Reported by Students</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-purple-100 shadow-xs">
                <div className="flex items-center justify-between text-purple-600 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Hardware Alerts</span>
                  <Activity className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-black text-purple-600">{dashboardData?.recentHardwareAlertsCount || 0}</div>
                <span className="text-[11px] text-purple-600/80 font-medium">Unacknowledged</span>
              </div>
            </div>

            {/* Assigned Facilities Quick Status Strip */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide uppercase">Operational Readiness by Facility</h3>
                  <p className="text-xs text-slate-500">Live capacity utilization and workstation distribution across your assigned rooms</p>
                </div>
                <button
                  onClick={() => setActiveTab('occupancy')}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1 cursor-pointer"
                >
                  <span>Open Interactive Workstation Grid</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {labs.length === 0 ? (
                  <div className="col-span-full py-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No laboratories currently assigned to this Assistant account.
                  </div>
                ) : (
                  labs.map((lab) => {
                    const labPcs = computers.filter(
                      (c) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase()
                    );
                    const occupiedCount = labPcs.filter((c) => c.state === 'IN_USE').length;
                    const availCount = labPcs.filter((c) => c.state === 'AVAILABLE').length;
                    const maintCount = labPcs.filter((c) => c.state === 'MAINTENANCE').length;
                    const totalPcs = labPcs.length;
                    const utilPercent = totalPcs > 0 ? Math.round((occupiedCount / totalPcs) * 100) : 0;

                    return (
                      <div
                        key={lab.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 rounded font-black text-xs bg-slate-900 text-white">
                                {lab.code}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">{lab.room}</span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm mt-1">{lab.name}</h4>
                            <p className="text-[11px] text-slate-400">{lab.building}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              lab.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {lab.status}
                          </span>
                        </div>

                        {/* Utilization Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-600">Occupancy</span>
                            <span className="font-bold text-slate-800">{utilPercent}% ({occupiedCount}/{totalPcs} PCs)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                            <div style={{ width: `${utilPercent}%` }} className="h-full bg-blue-600 rounded-full" />
                          </div>
                        </div>

                        {/* Breakdown pills */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 font-semibold">{availCount} Available</span>
                          <span className="text-blue-600 font-semibold">{occupiedCount} In Use</span>
                          <span className="text-amber-600 font-semibold">{maintCount} Maint</span>
                          <button
                            onClick={() => {
                              setSelectedLabFilter(lab.code);
                              setActiveTab('occupancy');
                            }}
                            className="text-slate-700 hover:text-slate-900 font-bold underline cursor-pointer"
                          >
                            Fleet View
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Operational Feeds: Active Alerts & Work Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Unacknowledged Hardware Events Feed */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900">Hardware Telemetry Stream</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('hardware')}
                    className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    View All ({hardwareEvents.length})
                  </button>
                </div>

                <div className="space-y-2.5">
                  {hardwareEvents.slice(0, 4).length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">No hardware events recorded.</div>
                  ) : (
                    hardwareEvents.slice(0, 4).map((ev) => (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-lg border text-xs flex items-start justify-between ${
                          ev.acknowledged
                            ? 'bg-slate-50 border-slate-200 text-slate-600'
                            : 'bg-rose-50/60 border-rose-200 text-rose-950'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{ev.labCode} • {ev.pcCode}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-white border text-slate-700">
                              {ev.eventType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700">{ev.description}</p>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        {!ev.acknowledged && (
                          <button
                            onClick={() => handleAcknowledgeEvent(ev.id)}
                            className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded font-bold text-[10px] cursor-pointer shadow-2xs"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Maintenance Work Orders In-Progress */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-slate-900">Active Maintenance Orders</h3>
                  </div>
                  <button
                    onClick={() => {
                      setMaintenanceSubTab('orders');
                      setActiveTab('maintenance');
                    }}
                    className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
                  >
                    View All ({maintenanceRecords.length})
                  </button>
                </div>

                <div className="space-y-2.5">
                  {maintenanceRecords.filter((m) => m.status !== 'COMPLETED').slice(0, 4).length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">Zero open maintenance tickets. Workstations all verified!</div>
                  ) : (
                    maintenanceRecords
                      .filter((m) => m.status !== 'COMPLETED')
                      .slice(0, 4)
                      .map((order) => (
                        <div
                          key={order.id}
                          className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 text-xs flex items-start justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{order.computerId}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                {order.status}
                              </span>
                            </div>
                            <p className="text-slate-700 font-medium">{order.actionTaken}</p>
                            <span className="text-[10px] text-slate-500">
                              Tech: {order.responsibleUser} • Started {new Date(order.startTime).toLocaleDateString()}
                            </span>
                          </div>

                          <button
                            onClick={() => handleCompleteMaintenance(order.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] cursor-pointer shadow-xs"
                          >
                            Sign Off
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: LIVE WORKSTATION FLEET OCCUPANCY */}
        {/* ================================================================= */}
        {activeTab === 'occupancy' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filter Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Lab Filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-600">Lab:</span>
                  <select
                    value={selectedLabFilter}
                    onChange={(e) => setSelectedLabFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 font-semibold text-slate-800"
                  >
                    <option value="ALL">All Assigned Facilities</option>
                    {labs.map((l) => (
                      <option key={l.id} value={l.code}>
                        {l.code} ({l.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* State Filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-600">Status:</span>
                  <select
                    value={pcStateFilter}
                    onChange={(e) => setPcStateFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 font-semibold text-slate-800"
                  >
                    <option value="ALL">All States</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="IN_USE">Occupied / In Use</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="DISABLED">Disabled</option>
                    <option value="OFFLINE">Offline</option>
                  </select>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search PC, Client ID, IP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white w-48 text-slate-800"
                  />
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-4 text-xs font-semibold">
                <div className="flex items-center space-x-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Available</span>
                </div>
                <div className="flex items-center space-x-1.5 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>In Use</span>
                </div>
                <div className="flex items-center space-x-1.5 text-amber-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>Maintenance</span>
                </div>
                <div className="flex items-center space-x-1.5 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span>Disabled</span>
                </div>
              </div>
            </div>

            {/* Grid of Workstations */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredComputers.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                  No workstations found matching the selected filter criteria.
                </div>
              ) : (
                filteredComputers.map((pc) => {
                  const activeSession = sessions.find(
                    (s) => (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) && s.status === 'ACTIVE'
                  );
                  const isInUse = pc.state === 'IN_USE' || !!activeSession;
                  const isMaint = pc.state === 'MAINTENANCE';
                  const isDisabled = pc.state === 'DISABLED';
                  const isOffline = !pc.isOnline || pc.state === 'OFFLINE';

                  return (
                    <div
                      key={pc.id}
                      onClick={() => setSelectedPc({ ...pc, activeSession })}
                      className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                        isMaint
                          ? 'bg-amber-50/60 border-amber-200 hover:border-amber-400'
                          : isDisabled
                          ? 'bg-rose-50/60 border-rose-200 hover:border-rose-400'
                          : isInUse
                          ? 'bg-blue-50/60 border-blue-300 hover:border-blue-400'
                          : isOffline
                          ? 'bg-slate-100 border-slate-300 opacity-70'
                          : 'bg-white border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold text-slate-500">{pc.labCode}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isMaint
                              ? 'bg-amber-500'
                              : isDisabled
                              ? 'bg-rose-500'
                              : isInUse
                              ? 'bg-blue-600 animate-pulse'
                              : isOffline
                              ? 'bg-slate-400'
                              : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      <div className="my-2 flex flex-col items-center justify-center">
                        <Monitor
                          className={`w-8 h-8 ${
                            isMaint
                              ? 'text-amber-500'
                              : isDisabled
                              ? 'text-rose-500'
                              : isInUse
                              ? 'text-blue-600'
                              : isOffline
                              ? 'text-slate-400'
                              : 'text-emerald-600'
                          }`}
                        />
                        <h4 className="font-black text-sm text-slate-900 mt-1">{pc.pcCode}</h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between font-semibold">
                          <span
                            className={
                              isMaint
                                ? 'text-amber-700'
                                : isDisabled
                                ? 'text-rose-700'
                                : isInUse
                                ? 'text-blue-700'
                                : isOffline
                                ? 'text-slate-500'
                                : 'text-emerald-700'
                            }
                          >
                            {isMaint
                              ? 'MAINT'
                              : isDisabled
                              ? 'DISABLED'
                              : isInUse
                              ? 'OCCUPIED'
                              : isOffline
                              ? 'OFFLINE'
                              : 'AVAILABLE'}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {isInUse && activeSession ? getElapsedTimeString(activeSession.startedAt) : 'Ready'}
                          </span>
                        </div>

                        {isInUse && activeSession && (
                          <p className="text-[10px] text-blue-900 font-bold truncate">
                            {activeSession.studentName}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Workstation Inspection & Command Modal */}
            {selectedPc && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                        {selectedPc.pcCode}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Workstation Node Telemetry</h3>
                        <p className="text-xs text-slate-500">
                          {selectedPc.labCode} • Terminal ID: {selectedPc.clientId || `CLIENT-${selectedPc.pcCode}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPc(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Active Student Session Box */}
                  {selectedPc.activeSession ? (
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-950 flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          <span>Active Student Lab Session</span>
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Student Name:</span>
                          <span className="font-bold text-slate-900">{selectedPc.activeSession.studentName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Student Identifier:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {selectedPc.activeSession.studentIdentifier || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Duration Elapsed:</span>
                          <span className="font-bold text-blue-700">
                            {getElapsedTimeString(selectedPc.activeSession.startedAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Start Mode:</span>
                          <span className="font-bold text-slate-800">{selectedPc.activeSession.startMode || 'NORMAL'}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => setSessionToEnd(selectedPc.activeSession)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs"
                        >
                          Safely Terminate Student Session
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center justify-between">
                      <span>No active student session running on this node.</span>
                      <span className="font-bold text-emerald-600">IDLE & READY</span>
                    </div>
                  )}

                  {/* Hardware & Peripherals Specs */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Hardware & Peripherals</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Keyboard</span>
                        <span className="font-bold text-emerald-600 flex items-center space-x-1 mt-0.5">
                          <Check className="w-3 h-3" />
                          <span>Connected</span>
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Mouse</span>
                        <span className="font-bold text-emerald-600 flex items-center space-x-1 mt-0.5">
                          <Check className="w-3 h-3" />
                          <span>Connected</span>
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Display</span>
                        <span className="font-bold text-emerald-600 flex items-center space-x-1 mt-0.5">
                          <Check className="w-3 h-3" />
                          <span>Online</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">IP Address</span>
                        <span className="font-mono font-bold text-slate-800">
                          {selectedPc.ipAddress || '192.168.1.10' + (selectedPc.pcCode.slice(-1) || '1')}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Hostname</span>
                        <span className="font-mono font-bold text-slate-800">{selectedPc.hostname || `LAB-WS-${selectedPc.pcCode}`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Workstation State Controls */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Fleet Control & State Override</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleUpdatePcState(selectedPc.id, 'AVAILABLE')}
                        disabled={actionLoading || selectedPc.state === 'AVAILABLE'}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer ${
                          selectedPc.state === 'AVAILABLE'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        Available
                      </button>
                      <button
                        onClick={() => handleUpdatePcState(selectedPc.id, 'MAINTENANCE')}
                        disabled={actionLoading || selectedPc.state === 'MAINTENANCE'}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer ${
                          selectedPc.state === 'MAINTENANCE'
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-white hover:bg-amber-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        Maintenance
                      </button>
                      <button
                        onClick={() => handleUpdatePcState(selectedPc.id, 'DISABLED')}
                        disabled={actionLoading || selectedPc.state === 'DISABLED'}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer ${
                          selectedPc.state === 'DISABLED'
                            ? 'bg-rose-100 border-rose-300 text-rose-800'
                            : 'bg-white hover:bg-rose-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        Disable Node
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setNewMaintenanceData((prev) => ({
                          ...prev,
                          computerId: selectedPc.id,
                          labId: selectedPc.labId
                        }));
                        setSelectedPc(null);
                        setShowNewMaintenanceModal(true);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Create Work Order
                    </button>
                    <button
                      onClick={() => setSelectedPc(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: WHO'S IN / WHO'S OUT (LAB SESSIONS & ATTENDANCE) */}
        {/* ================================================================= */}
        {activeTab === 'sessions' && (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lab Occupancy & Attendance Roster</h2>
                <p className="text-xs text-slate-500">Real-time attendance of student sessions running across assigned laboratories</p>
              </div>

              {/* Sub-tab pills */}
              <div className="flex bg-slate-200 p-1 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setSessionsSubTab('active')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    sessionsSubTab === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active Right Now ({activeSessions.length})
                </button>
                <button
                  onClick={() => setSessionsSubTab('history')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    sessionsSubTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Completed Sessions History ({completedSessions.length})
                </button>
              </div>
            </div>

            {sessionsSubTab === 'active' ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Student ID</th>
                      <th className="px-4 py-3">Workstation</th>
                      <th className="px-4 py-3">Facility</th>
                      <th className="px-4 py-3">Started At</th>
                      <th className="px-4 py-3">Elapsed Duration</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          No students currently logged into workstations in your assigned laboratories.
                        </td>
                      </tr>
                    ) : (
                      activeSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                            <span>{s.studentName}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">{s.studentIdentifier || 'N/A'}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{s.pcCode}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{s.labCode}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono">
                            {new Date(s.startedAt).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 font-bold text-blue-700">
                            {getElapsedTimeString(s.startedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSessionToEnd(s)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-[11px] rounded-md cursor-pointer shadow-2xs"
                            >
                              Force End Session
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Student ID</th>
                      <th className="px-4 py-3">Workstation</th>
                      <th className="px-4 py-3">Facility</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Ended</th>
                      <th className="px-4 py-3">End Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          No completed sessions logged yet.
                        </td>
                      </tr>
                    ) : (
                      completedSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">{s.studentName}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{s.studentIdentifier || 'N/A'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{s.pcCode}</td>
                          <td className="px-4 py-3 text-slate-700">{s.labCode}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                            {new Date(s.startedAt).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                            {s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.endMode === 'FORCED_END'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {s.endMode || 'NORMAL'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: PHYSICAL EQUIPMENT & PERIPHERALS */}
        {/* ================================================================= */}
        {activeTab === 'equipment' && (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Peripherals & Physical Equipment</h2>
                <p className="text-xs text-slate-500">Inventory tracking, serial numbers, and rapid defective-to-spare swapping</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Asset Tag</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Brand & Model</th>
                    <th className="px-4 py-3">Serial Number</th>
                    <th className="px-4 py-3">Location / Workstation</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipment.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        No peripheral assets provisioned in your assigned laboratories.
                      </td>
                    </tr>
                  ) : (
                    equipment.map((eq) => (
                      <tr key={eq.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{eq.assetTag}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{eq.type}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {eq.brand} {eq.model}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{eq.serialNumber || 'N/A'}</td>
                        <td className="px-4 py-3">
                          {eq.pcCode ? (
                            <span className="font-bold text-slate-900">
                              {eq.labCode} • {eq.pcCode}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              SPARE IN {eq.labCode || 'LAB'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              eq.status === 'FUNCTIONAL' || eq.status === 'AVAILABLE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : eq.status === 'FAULTY'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {eq.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {eq.computerId && (
                            <button
                              onClick={() => setReplacingEquipment(eq)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold text-[11px] cursor-pointer shadow-2xs"
                            >
                              Swap / Replace
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Atomic Replacement Modal */}
            {replacingEquipment && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <form
                  onSubmit={handleReplaceEquipment}
                  className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Atomic Equipment Replacement</h3>
                      <p className="text-xs text-slate-500">
                        Replacing {replacingEquipment.type} ({replacingEquipment.assetTag}) on {replacingEquipment.pcCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplacingEquipment(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Select Replacement Spare from Lab Pool:
                      </label>
                      {availableSpares.length === 0 ? (
                        <div className="p-3 bg-rose-50 text-rose-700 rounded-lg font-medium border border-rose-200">
                          No available functional spares found for type '{replacingEquipment.type}'. Please register or repair a spare first.
                        </div>
                      ) : (
                        <select
                          value={spareEquipmentId}
                          onChange={(e) => setSpareEquipmentId(e.target.value)}
                          required
                          className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 font-medium"
                        >
                          <option value="">-- Choose Spare Asset --</option>
                          {availableSpares.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.assetTag} ({sp.brand} {sp.model}) - {sp.status}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Defect Log & Reason:</label>
                      <textarea
                        rows={3}
                        value={replacementNotes}
                        onChange={(e) => setReplacementNotes(e.target.value)}
                        placeholder="e.g. Left click non-responsive, internal cable fraying observed."
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setReplacingEquipment(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || !spareEquipmentId}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Perform Swap & Log Audit
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: HARDWARE TELEMETRY & DISCONNECT EVENTS */}
        {/* ================================================================= */}
        {activeTab === 'hardware' && (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Hardware Telemetry Stream</h2>
                <p className="text-xs text-slate-500">Live peripheral connect, disconnect, and port mismatch alerts</p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowNewEventModal(true)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Hardware Incident</span>
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-slate-600">Event Type:</span>
                <select
                  value={hardwareTypeFilter}
                  onChange={(e) => setHardwareTypeFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1 bg-slate-50 font-medium"
                >
                  <option value="ALL">All Event Types</option>
                  <option value="HARDWARE_DISCONNECTED">Hardware Disconnected</option>
                  <option value="HARDWARE_CONNECTED">Hardware Connected</option>
                  <option value="HARDWARE_MISMATCH">Hardware Mismatch</option>
                  <option value="DEVICE_MISSING">Device Missing</option>
                  <option value="PC_OFFLINE">PC Offline</option>
                </select>

                <label className="flex items-center space-x-1.5 cursor-pointer select-none font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={unackOnly}
                    onChange={(e) => setUnackOnly(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Unacknowledged Only</span>
                </label>
              </div>

              <span className="text-slate-400 font-semibold">
                Showing {filteredHardwareEvents.length} events
              </span>
            </div>

            {/* Events List */}
            <div className="space-y-3">
              {filteredHardwareEvents.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-xl text-xs">
                  Zero hardware alert events found matching current criteria.
                </div>
              ) : (
                filteredHardwareEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-4 rounded-xl border transition-all flex items-start justify-between shadow-xs ${
                      ev.acknowledged
                        ? 'bg-white border-slate-200 text-slate-700'
                        : 'bg-rose-50/70 border-rose-200 text-rose-950 shadow-sm'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-slate-900 text-white">
                          {ev.labCode} • {ev.pcCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            ev.eventType.includes('DISCONNECT') || ev.eventType.includes('MISSING')
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {ev.eventType}
                        </span>
                        <span className="text-slate-400 font-mono text-xs">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{ev.description}</p>
                      {ev.acknowledged && (
                        <p className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Acknowledged by {ev.acknowledgedBy || 'Lab Assistant'}</span>
                        </p>
                      )}
                    </div>

                    {!ev.acknowledged ? (
                      <button
                        onClick={() => handleAcknowledgeEvent(ev.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Acknowledge Alert
                      </button>
                    ) : (
                      <span className="text-slate-400 font-bold text-xs">Acknowledged</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Manual Hardware Incident Modal */}
            {showNewEventModal && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <form
                  onSubmit={handleCreateHardwareEvent}
                  className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900">Log Hardware Incident</h3>
                    <button
                      type="button"
                      onClick={() => setShowNewEventModal(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Facility Code:</label>
                      <select
                        value={newEventData.labCode}
                        onChange={(e) => setNewEventData({ ...newEventData, labCode: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      >
                        {labs.map((l) => (
                          <option key={l.id} value={l.code}>
                            {l.code} ({l.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Workstation Code (e.g. PC-01):</label>
                      <input
                        type="text"
                        required
                        placeholder="PC-01"
                        value={newEventData.pcCode}
                        onChange={(e) => setNewEventData({ ...newEventData, pcCode: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 font-bold uppercase"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Incident Type:</label>
                      <select
                        value={newEventData.eventType}
                        onChange={(e) => setNewEventData({ ...newEventData, eventType: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 font-medium"
                      >
                        <option value="HARDWARE_DISCONNECTED">HARDWARE_DISCONNECTED</option>
                        <option value="HARDWARE_CONNECTED">HARDWARE_CONNECTED</option>
                        <option value="HARDWARE_MISMATCH">HARDWARE_MISMATCH</option>
                        <option value="DEVICE_MISSING">DEVICE_MISSING</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Description:</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="e.g. USB port #2 damaged, mouse physically detached."
                        value={newEventData.description}
                        onChange={(e) => setNewEventData({ ...newEventData, description: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowNewEventModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Record Incident
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: ISSUES & MAINTENANCE WORK ORDERS */}
        {/* ================================================================= */}
        {activeTab === 'maintenance' && (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Issues Triage & Maintenance Queue</h2>
                <p className="text-xs text-slate-500">Student defect reports and maintenance work order sign-offs</p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowNewMaintenanceModal(true)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Work Order</span>
                </button>
              </div>
            </div>

            {/* Sub-tab navigation */}
            <div className="flex bg-slate-200 p-1 rounded-lg text-xs font-bold w-fit">
              <button
                onClick={() => setMaintenanceSubTab('issues')}
                className={`px-4 py-1.5 rounded-md cursor-pointer transition-colors ${
                  maintenanceSubTab === 'issues' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Reported Student Issues ({issues.length})
              </button>
              <button
                onClick={() => setMaintenanceSubTab('orders')}
                className={`px-4 py-1.5 rounded-md cursor-pointer transition-colors ${
                  maintenanceSubTab === 'orders' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Maintenance Orders ({maintenanceRecords.length})
              </button>
            </div>

            {maintenanceSubTab === 'issues' ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Workstation</th>
                      <th className="px-4 py-3">Issue Category</th>
                      <th className="px-4 py-3">Problem Description</th>
                      <th className="px-4 py-3">Reported By</th>
                      <th className="px-4 py-3">Reported Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {issues.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          Zero reported issues in your assigned facilities.
                        </td>
                      </tr>
                    ) : (
                      issues.map((issue) => (
                        <tr key={issue.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {issue.labCode} • {issue.pcCode}
                          </td>
                          <td className="px-4 py-3 font-semibold text-rose-600">{issue.issueType}</td>
                          <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{issue.description}</td>
                          <td className="px-4 py-3 text-slate-500">{issue.reporterName || 'Student'}</td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                            {new Date(issue.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                issue.status === 'RESOLVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : issue.status === 'MAINTENANCE'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {issue.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setSelectedIssueForUpdate(issue);
                                setIssueUpdateStatus(issue.status);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-md cursor-pointer"
                            >
                              Triage
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Workstation</th>
                      <th className="px-4 py-3">Technician</th>
                      <th className="px-4 py-3">Action Taken / Service</th>
                      <th className="px-4 py-3">Date Started</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maintenanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          Zero maintenance records logged.
                        </td>
                      </tr>
                    ) : (
                      maintenanceRecords.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-slate-500 font-semibold">{m.id.slice(0, 8)}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{m.computerId}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{m.responsibleUser}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{m.actionTaken}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                            {new Date(m.startTime).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                m.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {m.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleCompleteMaintenance(m.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-md cursor-pointer shadow-2xs"
                              >
                                Sign Off & Complete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Create Maintenance Modal */}
            {showNewMaintenanceModal && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <form
                  onSubmit={handleCreateMaintenance}
                  className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900">New Maintenance Order</h3>
                    <button
                      type="button"
                      onClick={() => setShowNewMaintenanceModal(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Select Facility:</label>
                      <select
                        value={newMaintenanceData.labId}
                        onChange={(e) => setNewMaintenanceData({ ...newMaintenanceData, labId: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      >
                        {labs.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} ({l.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Target Workstation Node:</label>
                      <select
                        value={newMaintenanceData.computerId}
                        onChange={(e) => setNewMaintenanceData({ ...newMaintenanceData, computerId: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 font-bold"
                      >
                        <option value="">-- Select Workstation --</option>
                        {computers
                          .filter((c) => !newMaintenanceData.labId || c.labId === newMaintenanceData.labId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.pcCode} ({c.labCode}) - {c.state}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Action / Repair Plan:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Replace faulty CPU fan and re-apply thermal paste"
                        value={newMaintenanceData.actionTaken}
                        onChange={(e) => setNewMaintenanceData({ ...newMaintenanceData, actionTaken: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Technician / Responsible User:</label>
                      <input
                        type="text"
                        placeholder="Self (Lab Assistant)"
                        value={newMaintenanceData.responsibleUser}
                        onChange={(e) =>
                          setNewMaintenanceData({ ...newMaintenanceData, responsibleUser: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Internal Notes:</label>
                      <textarea
                        rows={2}
                        placeholder="Any additional diagnostic details"
                        value={newMaintenanceData.notes}
                        onChange={(e) => setNewMaintenanceData({ ...newMaintenanceData, notes: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowNewMaintenanceModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Dispatch Order
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Triage Issue Modal */}
            {selectedIssueForUpdate && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900">Issue Triage & Resolution</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedIssueForUpdate(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <span className="font-bold text-slate-900 block">
                        {selectedIssueForUpdate.labCode} • {selectedIssueForUpdate.pcCode}
                      </span>
                      <p className="text-slate-600">{selectedIssueForUpdate.description}</p>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Update Status:</label>
                      <select
                        value={issueUpdateStatus}
                        onChange={(e) => setIssueUpdateStatus(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 font-bold"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="INVESTIGATING">INVESTIGATING</option>
                        <option value="MAINTENANCE">MAINTENANCE (Auto-creates Work Order)</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Resolution / Triage Notes:</label>
                      <textarea
                        rows={3}
                        value={issueResolutionNotes}
                        onChange={(e) => setIssueResolutionNotes(e.target.value)}
                        placeholder="Explain verification or steps taken..."
                        className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIssueForUpdate(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateIssue}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Save Status
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: MY ASSIGNED FACILITIES */}
        {/* ================================================================= */}
        {activeTab === 'labs' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Authorized Laboratory Facilities</h2>
              <p className="text-xs text-slate-500">
                Institutional facilities officially assigned to your supervisory scope by the System Administrator
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {labs.map((lab) => {
                const labPcs = computers.filter(
                  (c) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase()
                );
                const activeSess = sessions.filter(
                  (s) =>
                    s.status === 'ACTIVE' &&
                    (s.labId === lab.id || s.labCode?.toUpperCase() === lab.code.toUpperCase())
                );
                const labEquip = equipment.filter(
                  (eq) => eq.labId === lab.id || eq.labCode?.toUpperCase() === lab.code.toUpperCase()
                );

                return (
                  <div
                    key={lab.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 rounded-md font-black text-xs bg-slate-900 text-white tracking-wide">
                            {lab.code}
                          </span>
                          <span className="font-semibold text-slate-600 text-xs">{lab.room}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-2">{lab.name}</h3>
                        <p className="text-xs text-slate-500">{lab.building}</p>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {lab.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{lab.description}</p>

                    <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Fleet Size</span>
                        <span className="font-black text-slate-900 text-base">{labPcs.length} PCs</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Capacity</span>
                        <span className="font-black text-slate-900 text-base">{lab.capacity} Seats</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Peripherals</span>
                        <span className="font-black text-slate-900 text-base">{labEquip.length} Assets</span>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedLabFilter(lab.code);
                          setActiveTab('occupancy');
                        }}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Inspect Fleet Workstations</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 8: FACILITY REPORTS & EXPORTS                                */}
        {/* ================================================================= */}
        {activeTab === 'reports' && (
          <ReportingCenter defaultLab={selectedLabFilter} />
        )}
      </div>

      {/* Force End Student Session Confirmation Modal */}
      {sessionToEnd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Authoritative Session Termination</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to end student session for{' '}
                <span className="font-bold text-slate-800">{sessionToEnd.studentName}</span> on{' '}
                <span className="font-bold text-slate-800">
                  {sessionToEnd.labCode} • {sessionToEnd.pcCode}
                </span>
                ?
              </p>
              <p className="text-[11px] text-rose-600 font-semibold pt-1">
                The workstation terminal will authoritatively close and return to AVAILABLE state.
              </p>
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                onClick={() => setSessionToEnd(null)}
                disabled={endingSession}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndSession}
                disabled={endingSession}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs"
              >
                {endingSession ? 'Terminating...' : 'Yes, End Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

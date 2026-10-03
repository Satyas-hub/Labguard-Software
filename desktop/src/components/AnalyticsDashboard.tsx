// ============================================================================
// LABGUARD V2: True Aggregated Analytics Dashboard (Phase 23: Analytics Dashboard)
// Zero mock charts, pure aggregated data from institutional data stores,
// with explicit empty states when no activity is recorded.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { ApiClient } from '../services/api';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Activity,
  AlertTriangle,
  Wrench,
  Monitor,
  Building2,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Inbox
} from 'lucide-react';

export const AnalyticsDashboard: React.FC<{ defaultLab?: string }> = ({ defaultLab = 'ALL' }) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedLab, setSelectedLab] = useState<string>(defaultLab);
  const [labs, setLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load labs list
  useEffect(() => {
    const fetchLabs = async () => {
      try {
        const res = await ApiClient.request('/labs');
        if (res.success && res.data) {
          setLabs(res.data);
        }
      } catch {}
    };
    fetchLabs();
  }, []);

  // Fetch analytics telemetry
  const fetchAnalytics = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = `timeframe=${timeframe}`;
      if (selectedLab !== 'ALL') {
        query += `&labCode=${encodeURIComponent(selectedLab)}`;
      }

      const res = await ApiClient.request(`/analytics/dashboard?${query}`);
      if (res.success && res.data) {
        setAnalytics(res.data);
      } else {
        setErrorMsg(res.message || 'Failed to load institutional analytics');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to analytics engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe, selectedLab]);

  const maxHourCount = analytics?.utilization?.hourlyDistribution
    ? Math.max(1, ...analytics.utilization.hourlyDistribution.map((h: any) => h.sessionCount))
    : 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Operational Analytics &amp; Intelligence</span>
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              Aggregated Live Metrics
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-dimensional operational metrics across laboratories, fleets, and hardware maintenance
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Facility Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedLab}
              onChange={(e) => setSelectedLab(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Facilities</option>
              {labs.map((l) => (
                <option key={l.id} value={l.code}>
                  {l.code}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
            {(['7d', '30d', '90d', 'all'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : tf === '90d' ? '90 Days' : 'All Time'}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {analytics && (
        <>
          {/* Top 4 Primary KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Active Hours */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Lab Usage</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                  {analytics.utilization.totalDurationHours} <span className="text-xs font-semibold text-slate-500">hrs</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {analytics.utilization.totalSessions} sessions ({analytics.utilization.avgSessionMinutes}m avg)
                </p>
              </div>
            </div>

            {/* Fleet Online Health */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fleet Online Rate</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                  {analytics.fleetHealth.onlinePercentage}%
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {analytics.fleetHealth.onlineCount} of {analytics.fleetHealth.totalWorkstations} workstations active
                </p>
              </div>
            </div>

            {/* Issue Resolution Rate */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Issue Resolution</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                  {analytics.issues.resolutionRatePercent}%
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {analytics.issues.resolvedCount} of {analytics.issues.totalReported} resolved ({analytics.issues.openCount} open)
                </p>
              </div>
            </div>

            {/* Maintenance Spend */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Maintenance Triage</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                  ${analytics.maintenance.totalCost.toFixed(2)}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {analytics.maintenance.totalOrders} work orders (${analytics.maintenance.avgRepairCost} avg)
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Hourly Usage Distribution (Visual Bar Chart) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>24-Hour Workstation Fleet Hourly Distribution</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Peak utilization period:{' '}
                  <span className="font-bold text-slate-800">{analytics.utilization.peakHour}</span>
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500" />
                <span>Session Volume</span>
              </div>
            </div>

            {!analytics.emptyStates.hasSessions ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Inbox className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-semibold">0 Sessions / No activity logged in this timeframe</p>
              </div>
            ) : (
              <div className="pt-6">
                <div className="flex items-end space-x-1.5 h-36 border-b border-slate-100 pb-2">
                  {analytics.utilization.hourlyDistribution.map((item: any) => {
                    const heightPercent = item.sessionCount > 0 ? Math.max(12, Math.round((item.sessionCount / maxHourCount) * 100)) : 4;
                    return (
                      <div key={item.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        {item.sessionCount > 0 && (
                          <div className="absolute -top-7 hidden group-hover:flex px-1.5 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded shadow-xs z-10 whitespace-nowrap">
                            {item.sessionCount} sessions
                          </div>
                        )}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t transition-all ${
                            item.sessionCount > 0 ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-slate-100'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-2 px-1">
                  <span>00:00</span>
                  <span>04:00</span>
                  <span>08:00</span>
                  <span>12:00</span>
                  <span>16:00</span>
                  <span>20:00</span>
                  <span>23:00</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Dual Columns — Issue Breakdown & Maintenance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Issue Category Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Issue Category Distribution</span>
              </h3>

              {!analytics.emptyStates.hasIssues ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-xs font-semibold">Zero Issues Reported in this timeframe</p>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {analytics.issues.categoryBreakdown.map((cat: any) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700">{cat.category}</span>
                        <span className="text-slate-500">
                          {cat.count} ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fleet Status Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-blue-500" />
                <span>Workstation Fleet Status Matrix</span>
              </h3>

              {!analytics.emptyStates.hasFleet ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Inbox className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-semibold">No workstations registered</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Available</span>
                    <p className="text-2xl font-black text-emerald-950 mt-1">
                      {analytics.fleetHealth.totalWorkstations -
                        analytics.fleetHealth.inUseCount -
                        analytics.fleetHealth.maintenanceCount}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">Ready for login</p>
                  </div>

                  <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
                    <span className="text-[10px] font-bold text-blue-700 uppercase">In Use</span>
                    <p className="text-2xl font-black text-blue-950 mt-1">
                      {analytics.fleetHealth.inUseCount}
                    </p>
                    <p className="text-[10px] text-blue-600 mt-0.5">Active student sessions</p>
                  </div>

                  <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-700 uppercase">Maintenance</span>
                    <p className="text-2xl font-black text-amber-950 mt-1">
                      {analytics.fleetHealth.maintenanceCount}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Under bench repair</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Offline</span>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                      {analytics.fleetHealth.offlineCount}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">No heartbeat signal</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

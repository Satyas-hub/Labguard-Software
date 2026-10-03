"use strict";
// ============================================================================
// LABGUARD V2: True Aggregated Analytics Controller (Phase 23: Analytics Dashboard)
// Computes multi-dimensional institutional metrics with ZERO mock data.
// Accurately reflects 0 / empty states when fresh or inactive.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAggregatedAnalytics = void 0;
const pool_1 = require("../db/pool");
const assistantController_1 = require("./assistantController");
const getAggregatedAnalytics = async (req, res) => {
    const user = req.user;
    const timeframe = req.query.timeframe || '30d';
    let targetLab = req.query.labCode || 'ALL';
    // Role scoping
    if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (targetLab !== 'ALL' && !(0, assistantController_1.isLabInScope)(user, undefined, targetLab)) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN_SCOPE',
                message: `Unauthorized for facility ${targetLab}`
            });
        }
    }
    // Calculate timeframe cutoff timestamp
    const now = Date.now();
    let cutoffMs = 0;
    if (timeframe === '7d') {
        cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
    }
    else if (timeframe === '30d') {
        cutoffMs = now - 30 * 24 * 60 * 60 * 1000;
    }
    else if (timeframe === '90d') {
        cutoffMs = now - 90 * 24 * 60 * 60 * 1000;
    }
    // Retrieve raw data
    let allLabs = pool_1.db.getStore('labs');
    let allPcs = pool_1.db.getStore('computers');
    let allSessions = pool_1.db.getStore('sessions');
    let allIssues = pool_1.db.getStore('issues');
    let allMaintenance = pool_1.db.getStore('maintenance');
    // Filter by user assigned labs if not admin
    if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            allLabs = allLabs.filter((l) => (0, assistantController_1.isLabInScope)(user, l.id, l.code));
            allPcs = allPcs.filter((p) => (0, assistantController_1.isLabInScope)(user, p.labId, p.labCode));
            allSessions = allSessions.filter((s) => (0, assistantController_1.isLabInScope)(user, s.labId, s.labCode));
            allIssues = allIssues.filter((i) => (0, assistantController_1.isLabInScope)(user, i.labId, i.labCode));
            allMaintenance = allMaintenance.filter((m) => (0, assistantController_1.isLabInScope)(user, m.labId, m.labCode));
        }
        else {
            allLabs = [];
            allPcs = [];
            allSessions = [];
            allIssues = [];
            allMaintenance = [];
        }
    }
    // Filter by target laboratory if selected
    if (targetLab !== 'ALL') {
        const cleanTarget = targetLab.toUpperCase();
        allPcs = allPcs.filter((p) => p.labCode?.toUpperCase() === cleanTarget);
        allSessions = allSessions.filter((s) => s.labCode?.toUpperCase() === cleanTarget);
        allIssues = allIssues.filter((i) => i.labCode?.toUpperCase() === cleanTarget);
        allMaintenance = allMaintenance.filter((m) => (m.labCode?.toUpperCase() === cleanTarget) || m.labId === cleanTarget);
    }
    // Filter by timeframe
    if (cutoffMs > 0) {
        allSessions = allSessions.filter((s) => new Date(s.startedAt).getTime() >= cutoffMs);
        allIssues = allIssues.filter((i) => new Date(i.createdAt).getTime() >= cutoffMs);
        allMaintenance = allMaintenance.filter((m) => new Date(m.startTime).getTime() >= cutoffMs);
    }
    // --------------------------------------------------------------------------
    // 1. UTILIZATION ANALYTICS
    // --------------------------------------------------------------------------
    const totalSessions = allSessions.length;
    let totalDurationMinutes = 0;
    const hourCounts = new Array(24).fill(0);
    allSessions.forEach((s) => {
        const start = new Date(s.startedAt);
        const end = s.endedAt ? new Date(s.endedAt) : new Date();
        const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        totalDurationMinutes += mins;
        const hour = start.getHours();
        if (hour >= 0 && hour < 24) {
            hourCounts[hour]++;
        }
    });
    const totalDurationHours = Math.round((totalDurationMinutes / 60) * 10) / 10;
    const avgSessionMinutes = totalSessions > 0 ? Math.round(totalDurationMinutes / totalSessions) : 0;
    let peakHourIndex = -1;
    let maxHourlySessions = 0;
    hourCounts.forEach((count, h) => {
        if (count > maxHourlySessions) {
            maxHourlySessions = count;
            peakHourIndex = h;
        }
    });
    const peakHourStr = peakHourIndex >= 0 && maxHourlySessions > 0 ? `${peakHourIndex.toString().padStart(2, '0')}:00` : 'None';
    const hourlyDistribution = hourCounts.map((count, hour) => ({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        sessionCount: count
    }));
    const activeSessionsCount = allSessions.filter((s) => s.status === 'ACTIVE').length;
    const totalFleetCount = allPcs.length || 1;
    const activeOccupancyPercent = Math.min(100, Math.round((activeSessionsCount / totalFleetCount) * 100));
    // --------------------------------------------------------------------------
    // 2. ISSUES ANALYTICS
    // --------------------------------------------------------------------------
    const totalIssues = allIssues.length;
    const resolvedIssues = allIssues.filter((i) => i.status === 'RESOLVED').length;
    const openIssues = allIssues.filter((i) => i.status === 'OPEN').length;
    const resolutionRatePercent = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
    const categoryMap = {};
    allIssues.forEach((i) => {
        const cat = i.issueType || 'OTHER';
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(categoryMap).map(([category, count]) => ({
        category,
        count,
        percentage: totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0
    }));
    // --------------------------------------------------------------------------
    // 3. MAINTENANCE TRENDS
    // --------------------------------------------------------------------------
    const totalMaintenanceOrders = allMaintenance.length;
    const inProgressMaint = allMaintenance.filter((m) => m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED').length;
    const completedMaint = allMaintenance.filter((m) => m.status === 'COMPLETED').length;
    const totalCost = allMaintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
    const avgRepairCost = totalMaintenanceOrders > 0 ? Math.round((totalCost / totalMaintenanceOrders) * 100) / 100 : 0;
    // --------------------------------------------------------------------------
    // 4. FLEET TELEMETRY & HEALTH
    // --------------------------------------------------------------------------
    const onlinePcs = allPcs.filter((p) => p.isOnline).length;
    const offlinePcs = allPcs.filter((p) => !p.isOnline || p.state === 'OFFLINE').length;
    const inUsePcs = allPcs.filter((p) => p.state === 'IN_USE').length;
    const maintPcs = allPcs.filter((p) => p.state === 'MAINTENANCE').length;
    const fleetOnlinePercent = allPcs.length > 0 ? Math.round((onlinePcs / allPcs.length) * 100) : 0;
    return res.json({
        success: true,
        data: {
            timeframe,
            labCode: targetLab,
            generatedAt: new Date().toISOString(),
            utilization: {
                totalSessions,
                totalDurationHours,
                avgSessionMinutes,
                activeOccupancyPercent,
                peakHour: peakHourStr,
                hourlyDistribution
            },
            issues: {
                totalReported: totalIssues,
                openCount: openIssues,
                resolvedCount: resolvedIssues,
                resolutionRatePercent,
                categoryBreakdown
            },
            maintenance: {
                totalOrders: totalMaintenanceOrders,
                inProgressCount: inProgressMaint,
                completedCount: completedMaint,
                totalCost,
                avgRepairCost
            },
            fleetHealth: {
                totalWorkstations: allPcs.length,
                onlineCount: onlinePcs,
                offlineCount: offlinePcs,
                inUseCount: inUsePcs,
                maintenanceCount: maintPcs,
                onlinePercentage: fleetOnlinePercent
            },
            emptyStates: {
                hasSessions: totalSessions > 0,
                hasIssues: totalIssues > 0,
                hasMaintenance: totalMaintenanceOrders > 0,
                hasFleet: allPcs.length > 0
            }
        }
    });
};
exports.getAggregatedAnalytics = getAggregatedAnalytics;

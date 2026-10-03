"use strict";
// ============================================================================
// LABGUARD V2: Report Management Controller (Phase 22: Reporting System)
// Enforces role-based reporting permissions, scoped data extraction,
// and multi-format exports for CSV, Excel XML, and Printable PDF layouts.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportReport = exports.generateReport = exports.getReportTypes = void 0;
const reportService_1 = require("../services/reportService");
const assistantController_1 = require("./assistantController");
/**
 * Returns available report definitions and permitted export formats based on user role.
 * GET /api/reports/types
 */
const getReportTypes = async (req, res) => {
    const user = req.user;
    let availableTypes = [];
    if (user.role === 'ADMIN') {
        availableTypes = [
            { id: 'SESSION_HISTORY', title: 'Student Session History', description: 'Audited student login sessions across authorized computing workstations.' },
            { id: 'PC_USAGE', title: 'PC Usage & Workstation Telemetry', description: 'Detailed workstation fleet utilization, total active hours, and online uptime.' },
            { id: 'LAB_UTILIZATION', title: 'Lab Utilization & Capacity', description: 'Laboratory seat occupancy, session volumes, and capacity density metrics.' },
            { id: 'EQUIPMENT_MAINTENANCE', title: 'Equipment & Maintenance Log', description: 'Work orders, triage actions, spare parts replacement, and repair costs.' },
            { id: 'AUDIT_ACTIVITY', title: 'Security & Audit Activity Trail', description: 'Immutable administrative, security, and authentication event logs.' }
        ];
    }
    else if (user.role === 'FACULTY') {
        availableTypes = [
            { id: 'SESSION_HISTORY', title: 'Student Session History', description: 'Audited student login sessions across authorized computing workstations.' },
            { id: 'PC_USAGE', title: 'PC Usage & Workstation Telemetry', description: 'Detailed workstation fleet utilization in assigned laboratories.' },
            { id: 'LAB_UTILIZATION', title: 'Lab Utilization & Capacity', description: 'Laboratory seat occupancy and session volumes for assigned facilities.' }
        ];
    }
    else if (user.role === 'LAB_ASSISTANT') {
        availableTypes = [
            { id: 'SESSION_HISTORY', title: 'Student Session History', description: 'Student login sessions in assigned facilities.' },
            { id: 'PC_USAGE', title: 'PC Usage & Workstation Telemetry', description: 'Workstation fleet status and uptime in assigned facilities.' },
            { id: 'EQUIPMENT_MAINTENANCE', title: 'Equipment & Maintenance Log', description: 'Work orders and hardware maintenance records in assigned facilities.' }
        ];
    }
    else if (user.role === 'STUDENT') {
        availableTypes = [
            { id: 'SESSION_HISTORY', title: 'My Session History', description: 'Your personal historical workstation sessions and active lab hours.' }
        ];
    }
    return res.json({
        success: true,
        data: availableTypes,
        formats: ['CSV', 'EXCEL', 'PDF']
    });
};
exports.getReportTypes = getReportTypes;
/**
 * Checks authorization and prepares scoped filter parameters
 */
function resolveReportFilters(req, type) {
    const user = req.user;
    const query = req.method === 'POST' ? req.body : req.query;
    const labCode = query.labCode ? String(query.labCode).trim().toUpperCase() : undefined;
    const startDate = query.startDate ? String(query.startDate) : undefined;
    const endDate = query.endDate ? String(query.endDate) : undefined;
    const status = query.status ? String(query.status) : undefined;
    let studentId = query.studentId ? String(query.studentId) : undefined;
    // Student is strictly bound to own sessions
    if (user.role === 'STUDENT') {
        studentId = user.id;
    }
    // Check lab authorization for non-admin
    if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (labCode && labCode !== 'ALL' && !(0, assistantController_1.isLabInScope)(user, undefined, labCode)) {
            throw { status: 403, message: `Unauthorized for facility ${labCode}` };
        }
    }
    // Check report type authorization
    if (user.role === 'STUDENT' && type !== 'SESSION_HISTORY') {
        throw { status: 403, message: 'Students may only access personal session history reports' };
    }
    if ((user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') && type === 'AUDIT_ACTIVITY') {
        throw { status: 403, message: 'Audit activity reports are restricted to System Administrators' };
    }
    return {
        labCode,
        studentId,
        startDate,
        endDate,
        status
    };
}
/**
 * Generates structured report payload as JSON
 * POST /api/reports/generate
 */
const generateReport = async (req, res) => {
    try {
        const { reportType } = req.body;
        if (!reportType) {
            return res.status(400).json({ success: false, error: 'REPORT_TYPE_REQUIRED', message: 'reportType is required' });
        }
        const filters = resolveReportFilters(req, reportType);
        let report;
        switch (reportType) {
            case 'SESSION_HISTORY':
                report = reportService_1.ReportService.generateSessionHistoryReport(filters);
                break;
            case 'PC_USAGE':
                report = reportService_1.ReportService.generatePcUsageReport(filters);
                break;
            case 'LAB_UTILIZATION':
                report = reportService_1.ReportService.generateLabUtilizationReport(filters);
                break;
            case 'EQUIPMENT_MAINTENANCE':
                report = reportService_1.ReportService.generateEquipmentMaintenanceReport(filters);
                break;
            case 'AUDIT_ACTIVITY':
                report = reportService_1.ReportService.generateAuditActivityReport(filters);
                break;
            default:
                return res.status(400).json({ success: false, error: 'INVALID_REPORT_TYPE', message: `Unknown report type: ${reportType}` });
        }
        return res.json({
            success: true,
            data: report
        });
    }
    catch (err) {
        const status = err.status || 500;
        return res.status(status).json({
            success: false,
            error: 'REPORT_GENERATION_FAILED',
            message: err.message || 'Error generating report'
        });
    }
};
exports.generateReport = generateReport;
/**
 * Exports report in requested format (CSV, EXCEL, or PDF/HTML)
 * GET /api/reports/export/:reportType
 */
const exportReport = async (req, res) => {
    try {
        const { reportType } = req.params;
        const format = (req.query.format ? String(req.query.format).toUpperCase() : 'CSV');
        const filters = resolveReportFilters(req, reportType);
        let report;
        switch (reportType) {
            case 'SESSION_HISTORY':
                report = reportService_1.ReportService.generateSessionHistoryReport(filters);
                break;
            case 'PC_USAGE':
                report = reportService_1.ReportService.generatePcUsageReport(filters);
                break;
            case 'LAB_UTILIZATION':
                report = reportService_1.ReportService.generateLabUtilizationReport(filters);
                break;
            case 'EQUIPMENT_MAINTENANCE':
                report = reportService_1.ReportService.generateEquipmentMaintenanceReport(filters);
                break;
            case 'AUDIT_ACTIVITY':
                report = reportService_1.ReportService.generateAuditActivityReport(filters);
                break;
            default:
                return res.status(400).json({ success: false, error: 'INVALID_REPORT_TYPE', message: `Unknown report type: ${reportType}` });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFilename = `Labguard_${reportType}_${timestamp}`;
        if (format === 'CSV') {
            const csvData = reportService_1.ReportService.convertToCsv(report);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.csv"`);
            return res.status(200).send(csvData);
        }
        else if (format === 'EXCEL') {
            const excelData = reportService_1.ReportService.convertToExcel(report);
            res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.xls"`);
            return res.status(200).send(excelData);
        }
        else if (format === 'PDF') {
            const htmlData = reportService_1.ReportService.convertToPrintableHtml(report);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `inline; filename="${baseFilename}.html"`);
            return res.status(200).send(htmlData);
        }
        else {
            return res.status(400).json({
                success: false,
                error: 'INVALID_FORMAT',
                message: 'Supported formats are: CSV, EXCEL, PDF'
            });
        }
    }
    catch (err) {
        const status = err.status || 500;
        return res.status(status).json({
            success: false,
            error: 'REPORT_EXPORT_FAILED',
            message: err.message || 'Error exporting report'
        });
    }
};
exports.exportReport = exportReport;

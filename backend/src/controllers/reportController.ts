// ============================================================================
// LABGUARD V2: Report Management Controller (Phase 22: Reporting System)
// Enforces role-based reporting permissions, scoped data extraction,
// and multi-format exports for CSV, Excel XML, and Printable PDF layouts.
// ============================================================================

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ReportService, ReportType, ExportFormat } from '../services/reportService';
import { isLabInScope } from './assistantController';

/**
 * Returns available report definitions and permitted export formats based on user role.
 * GET /api/reports/types
 */
export const getReportTypes = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let availableTypes: { id: ReportType; title: string; description: string }[] = [];

  if (user.role === 'ADMIN') {
    availableTypes = [
      { id: 'SESSION_HISTORY', title: 'Student Session History', description: 'Audited student login sessions across authorized computing workstations.' },
      { id: 'PC_USAGE', title: 'PC Usage & Workstation Telemetry', description: 'Detailed workstation fleet utilization, total active hours, and online uptime.' },
      { id: 'LAB_UTILIZATION', title: 'Lab Utilization & Capacity', description: 'Laboratory seat occupancy, session volumes, and capacity density metrics.' },
      { id: 'EQUIPMENT_MAINTENANCE', title: 'Equipment & Maintenance Log', description: 'Work orders, triage actions, spare parts replacement, and repair costs.' },
      { id: 'AUDIT_ACTIVITY', title: 'Security & Audit Activity Trail', description: 'Immutable administrative, security, and authentication event logs.' }
    ];
  } else if (user.role === 'FACULTY') {
    availableTypes = [
      { id: 'SESSION_HISTORY', title: 'Student Session History', description: 'Audited student login sessions across authorized computing workstations.' },
      { id: 'PC_USAGE', title: 'PC Usage & Workstation Telemetry', description: 'Detailed workstation fleet utilization in assigned laboratories.' },
      { id: 'LAB_UTILIZATION', title: 'Lab Utilization & Capacity', description: 'Laboratory seat occupancy and session volumes for assigned facilities.' }
    ];
  } else if (user.role === 'LAB_ASSISTANT') {
    availableTypes = [
      { id: 'SESSION_HISTORY', title: 'Student Session History', description: 'Student login sessions in assigned facilities.' },
      { id: 'PC_USAGE', title: 'PC Usage & Workstation Telemetry', description: 'Workstation fleet status and uptime in assigned facilities.' },
      { id: 'EQUIPMENT_MAINTENANCE', title: 'Equipment & Maintenance Log', description: 'Work orders and hardware maintenance records in assigned facilities.' }
    ];
  } else if (user.role === 'STUDENT') {
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

/**
 * Checks authorization and prepares scoped filter parameters
 */
function resolveReportFilters(req: AuthenticatedRequest, type: ReportType) {
  const user = req.user!;
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
    if (labCode && labCode !== 'ALL' && !isLabInScope(user, undefined, labCode)) {
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
export const generateReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType } = req.body;
    if (!reportType) {
      return res.status(400).json({ success: false, error: 'REPORT_TYPE_REQUIRED', message: 'reportType is required' });
    }

    const filters = resolveReportFilters(req, reportType as ReportType);

    let report;
    switch (reportType as ReportType) {
      case 'SESSION_HISTORY':
        report = ReportService.generateSessionHistoryReport(filters);
        break;
      case 'PC_USAGE':
        report = ReportService.generatePcUsageReport(filters);
        break;
      case 'LAB_UTILIZATION':
        report = ReportService.generateLabUtilizationReport(filters);
        break;
      case 'EQUIPMENT_MAINTENANCE':
        report = ReportService.generateEquipmentMaintenanceReport(filters);
        break;
      case 'AUDIT_ACTIVITY':
        report = ReportService.generateAuditActivityReport(filters);
        break;
      default:
        return res.status(400).json({ success: false, error: 'INVALID_REPORT_TYPE', message: `Unknown report type: ${reportType}` });
    }

    return res.json({
      success: true,
      data: report
    });
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: 'REPORT_GENERATION_FAILED',
      message: err.message || 'Error generating report'
    });
  }
};

/**
 * Exports report in requested format (CSV, EXCEL, or PDF/HTML)
 * GET /api/reports/export/:reportType
 */
export const exportReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType } = req.params;
    const format = (req.query.format ? String(req.query.format).toUpperCase() : 'CSV') as ExportFormat;

    const filters = resolveReportFilters(req, reportType as ReportType);

    let report;
    switch (reportType as ReportType) {
      case 'SESSION_HISTORY':
        report = ReportService.generateSessionHistoryReport(filters);
        break;
      case 'PC_USAGE':
        report = ReportService.generatePcUsageReport(filters);
        break;
      case 'LAB_UTILIZATION':
        report = ReportService.generateLabUtilizationReport(filters);
        break;
      case 'EQUIPMENT_MAINTENANCE':
        report = ReportService.generateEquipmentMaintenanceReport(filters);
        break;
      case 'AUDIT_ACTIVITY':
        report = ReportService.generateAuditActivityReport(filters);
        break;
      default:
        return res.status(400).json({ success: false, error: 'INVALID_REPORT_TYPE', message: `Unknown report type: ${reportType}` });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `Labguard_${reportType}_${timestamp}`;

    if (format === 'CSV') {
      const csvData = ReportService.convertToCsv(report);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.csv"`);
      return res.status(200).send(csvData);
    } else if (format === 'EXCEL') {
      const excelData = ReportService.convertToExcel(report);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.xls"`);
      return res.status(200).send(excelData);
    } else if (format === 'PDF') {
      const htmlData = ReportService.convertToPrintableHtml(report);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${baseFilename}.html"`);
      return res.status(200).send(htmlData);
    } else {
      return res.status(400).json({
        success: false,
        error: 'INVALID_FORMAT',
        message: 'Supported formats are: CSV, EXCEL, PDF'
      });
    }
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: 'REPORT_EXPORT_FAILED',
      message: err.message || 'Error exporting report'
    });
  }
};

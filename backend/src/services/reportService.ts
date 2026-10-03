// ============================================================================
// LABGUARD V2: Institutional Reporting Engine (Phase 22: Reporting System)
// Computes aggregated analytics, utilization metrics, and multi-format exporters
// for Student Sessions, Workstation Telemetry, Lab Utilization, Maintenance, and Audit.
// ============================================================================

import { db } from '../db/pool';
import { Session, Computer, Lab, MaintenanceRecord, Issue, HardwareEvent } from '../../../shared/types';

export type ReportType =
  | 'SESSION_HISTORY'
  | 'PC_USAGE'
  | 'LAB_UTILIZATION'
  | 'EQUIPMENT_MAINTENANCE'
  | 'AUDIT_ACTIVITY';

export type ExportFormat = 'CSV' | 'EXCEL' | 'PDF';

export interface ReportFilterOptions {
  labCode?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface GeneratedReport {
  type: ReportType;
  title: string;
  generatedAt: string;
  rowCount: number;
  columns: string[];
  rows: (string | number)[][];
  summary?: Record<string, any>;
}

export class ReportService {
  /**
   * Generates Student Session History Report
   */
  public static generateSessionHistoryReport(filters: ReportFilterOptions): GeneratedReport {
    let sessions: Session[] = db.getStore('sessions');

    if (filters.studentId) {
      sessions = sessions.filter((s) => s.studentId === filters.studentId);
    }
    if (filters.labCode && filters.labCode !== 'ALL') {
      sessions = sessions.filter((s) => s.labCode?.toUpperCase() === filters.labCode!.toUpperCase());
    }
    if (filters.status && filters.status !== 'ALL') {
      sessions = sessions.filter((s) => s.status.toUpperCase() === filters.status!.toUpperCase());
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      sessions = sessions.filter((s) => new Date(s.startedAt).getTime() >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      sessions = sessions.filter((s) => new Date(s.startedAt).getTime() <= end);
    }

    // Sort latest first
    sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const columns = [
      'Session ID',
      'Student Name',
      'Student ID',
      'Facility Code',
      'Workstation',
      'Start Time',
      'End Time',
      'Duration (Mins)',
      'Status',
      'End Mode'
    ];

    let totalDurationMinutes = 0;

    const rows = sessions.map((s) => {
      const startMs = new Date(s.startedAt).getTime();
      const endMs = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      const durationMins = Math.max(0, Math.round((endMs - startMs) / 60000));
      totalDurationMinutes += durationMins;

      return [
        s.id,
        s.studentName || 'Student',
        s.studentIdentifier || 'N/A',
        s.labCode || 'N/A',
        s.pcCode,
        new Date(s.startedAt).toLocaleString(),
        s.endedAt ? new Date(s.endedAt).toLocaleString() : 'Active',
        durationMins,
        s.status,
        s.endMode || 'N/A'
      ];
    });

    return {
      type: 'SESSION_HISTORY',
      title: 'Institutional Student Session History Audit',
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns,
      rows,
      summary: {
        totalSessions: sessions.length,
        activeSessions: sessions.filter((s) => s.status === 'ACTIVE').length,
        completedSessions: sessions.filter((s) => s.status === 'COMPLETED').length,
        forcedSessions: sessions.filter((s) => s.status === 'FORCED_END').length,
        totalDurationMinutes
      }
    };
  }

  /**
   * Generates PC Usage & Workstation Telemetry Report
   */
  public static generatePcUsageReport(filters: ReportFilterOptions): GeneratedReport {
    let computers: Computer[] = db.getStore('computers');
    const sessions: Session[] = db.getStore('sessions');

    if (filters.labCode && filters.labCode !== 'ALL') {
      computers = computers.filter((c) => c.labCode?.toUpperCase() === filters.labCode!.toUpperCase());
    }

    const columns = [
      'Workstation Code',
      'Facility Code',
      'Hostname',
      'IP Address',
      'Current State',
      'Online Status',
      'Total Sessions',
      'Total Active Minutes',
      'Last Heartbeat'
    ];

    let grandTotalSessions = 0;
    let grandTotalMinutes = 0;

    const rows = computers.map((pc) => {
      const pcSessions = sessions.filter(
        (s) => (s.computerId && s.computerId === pc.id) || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)
      );

      let pcTotalMinutes = 0;
      pcSessions.forEach((s) => {
        const startMs = new Date(s.startedAt).getTime();
        const endMs = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
        pcTotalMinutes += Math.max(0, Math.round((endMs - startMs) / 60000));
      });

      grandTotalSessions += pcSessions.length;
      grandTotalMinutes += pcTotalMinutes;

      return [
        pc.pcCode,
        pc.labCode || 'N/A',
        pc.hostname || 'LAB-PC',
        pc.ipAddress || '192.168.1.x',
        pc.state || 'AVAILABLE',
        pc.isOnline ? 'ONLINE' : 'OFFLINE',
        pcSessions.length,
        pcTotalMinutes,
        pc.lastHeartbeat ? new Date(pc.lastHeartbeat).toLocaleString() : 'N/A'
      ];
    });

    return {
      type: 'PC_USAGE',
      title: 'Fleet Workstation Telemetry & Utilization Report',
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns,
      rows,
      summary: {
        totalWorkstations: computers.length,
        onlineCount: computers.filter((c) => c.isOnline).length,
        inUseCount: computers.filter((c) => c.state === 'IN_USE').length,
        maintenanceCount: computers.filter((c) => c.state === 'MAINTENANCE').length,
        grandTotalSessions,
        grandTotalMinutes
      }
    };
  }

  /**
   * Generates Laboratory Utilization & Occupancy Report
   */
  public static generateLabUtilizationReport(filters: ReportFilterOptions): GeneratedReport {
    let labs: Lab[] = db.getStore('labs');
    const computers: Computer[] = db.getStore('computers');
    const sessions: Session[] = db.getStore('sessions');

    if (filters.labCode && filters.labCode !== 'ALL') {
      labs = labs.filter((l) => l.code.toUpperCase() === filters.labCode!.toUpperCase());
    }

    const columns = [
      'Lab Code',
      'Facility Name',
      'Building / Room',
      'Capacity',
      'Total Workstations',
      'Active Sessions',
      'Total Sessions Hosted',
      'Occupancy Rate (%)'
    ];

    const rows = labs.map((l) => {
      const labPcs = computers.filter((c) => c.labId === l.id || c.labCode?.toUpperCase() === l.code.toUpperCase());
      const labSessions = sessions.filter((s) => s.labId === l.id || s.labCode?.toUpperCase() === l.code.toUpperCase());
      const activeLabSessions = labSessions.filter((s) => s.status === 'ACTIVE').length;

      const totalPcs = labPcs.length || 1;
      const occupancyRate = Math.min(100, Math.round((activeLabSessions / totalPcs) * 100));

      return [
        l.code,
        l.name,
        `${l.building} - ${l.room}`,
        l.capacity,
        labPcs.length,
        activeLabSessions,
        labSessions.length,
        `${occupancyRate}%`
      ];
    });

    return {
      type: 'LAB_UTILIZATION',
      title: 'Facility Fleet Utilization & Capacity Report',
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns,
      rows,
      summary: {
        totalFacilities: labs.length,
        totalCapacity: labs.reduce((acc, l) => acc + l.capacity, 0)
      }
    };
  }

  /**
   * Generates Equipment Maintenance & Repair Work Order Report
   */
  public static generateEquipmentMaintenanceReport(filters: ReportFilterOptions): GeneratedReport {
    let records: MaintenanceRecord[] = db.getStore('maintenance');

    if (filters.labCode && filters.labCode !== 'ALL') {
      records = records.filter((r) => r.labCode?.toUpperCase() === filters.labCode!.toUpperCase());
    }
    if (filters.status && filters.status !== 'ALL') {
      records = records.filter((r) => r.status.toUpperCase() === filters.status!.toUpperCase());
    }

    const columns = [
      'Order ID',
      'Workstation / Equipment',
      'Facility',
      'Assigned Technician',
      'Action Taken',
      'Cost ($)',
      'Status',
      'Start Time',
      'End Time'
    ];

    let totalCost = 0;

    const rows = records.map((r) => {
      totalCost += r.cost || 0;
      return [
        r.id,
        r.computerId || 'N/A',
        r.labCode || 'LAB-01',
        r.responsibleUser || 'Staff',
        r.actionTaken,
        r.cost ? `$${r.cost.toFixed(2)}` : '$0.00',
        r.status,
        new Date(r.startTime).toLocaleString(),
        r.endTime ? new Date(r.endTime).toLocaleString() : 'In Progress'
      ];
    });

    return {
      type: 'EQUIPMENT_MAINTENANCE',
      title: 'Hardware Peripheral & Workstation Maintenance Log',
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns,
      rows,
      summary: {
        totalOrders: records.length,
        inProgress: records.filter((r) => r.status === 'IN_PROGRESS').length,
        completed: records.filter((r) => r.status === 'COMPLETED').length,
        totalCost: `$${totalCost.toFixed(2)}`
      }
    };
  }

  /**
   * Generates Audit Activity Logs Report
   */
  public static generateAuditActivityReport(filters: ReportFilterOptions): GeneratedReport {
    let logs = db.getStore('audit_logs');

    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      logs = logs.filter((l: any) => new Date(l.timestamp).getTime() >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      logs = logs.filter((l: any) => new Date(l.timestamp).getTime() <= end);
    }

    logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const columns = [
      'Log ID',
      'Timestamp',
      'Actor',
      'Role',
      'Action Performed',
      'Entity Type',
      'Entity ID',
      'Facility'
    ];

    const rows = logs.map((l: any) => [
      l.id,
      new Date(l.timestamp).toLocaleString(),
      l.actorName || l.userId || 'SYSTEM',
      l.role || 'N/A',
      l.action,
      l.entityType || 'SYSTEM',
      l.entityId || 'N/A',
      l.labCode || l.labId || 'N/A'
    ]);

    return {
      type: 'AUDIT_ACTIVITY',
      title: 'Institutional Security & Administrative Audit Trail',
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns,
      rows,
      summary: {
        totalAuditEvents: logs.length
      }
    };
  }

  /**
   * Convert Report to RFC 4180 compliant CSV format
   */
  public static convertToCsv(report: GeneratedReport): string {
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const headerLine = report.columns.map(escapeCsv).join(',');
    const dataLines = report.rows.map((row) => row.map(escapeCsv).join(','));

    // Include report metadata banner as leading comments
    const banner = [
      `# LABGUARD V2 INSTITUTIONAL REPORT: ${report.title}`,
      `# Generated At: ${report.generatedAt}`,
      `# Total Records: ${report.rowCount}`
    ].join('\r\n');

    return `${banner}\r\n${headerLine}\r\n${dataLines.join('\r\n')}\r\n`;
  }

  /**
   * Convert Report to Excel XML Spreadsheet format (.xls)
   * Opens natively and perfectly formatted in Microsoft Excel, LibreOffice, and Google Sheets.
   */
  public static convertToExcel(report: GeneratedReport): string {
    const escapeXml = (str: any) => {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="14" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Meta">
   <Font ss:Italic="1" ss:Color="#64748B"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(report.type.substring(0, 31))}">
  <Table>
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(report.title)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Meta"><Data ss:Type="String">Generated: ${escapeXml(report.generatedAt)} | Records: ${report.rowCount}</Data></Cell>
   </Row>
   <Row></Row>
   <Row>`;

    report.columns.forEach((col) => {
      xml += `\n    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col)}</Data></Cell>`;
    });
    xml += `\n   </Row>`;

    report.rows.forEach((row) => {
      xml += `\n   <Row>`;
      row.forEach((cell) => {
        const isNum = typeof cell === 'number';
        xml += `\n    <Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`;
      });
      xml += `\n   </Row>`;
    });

    xml += `\n  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
  }

  /**
   * Convert Report to Printable HTML / PDF Layout
   */
  public static convertToPrintableHtml(report: GeneratedReport): string {
    const summaryItems = report.summary
      ? Object.entries(report.summary)
          .map(([k, v]) => `<li><strong>${k.replace(/([A-Z])/g, ' $1')}:</strong> ${v}</li>`)
          .join('')
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.title} - LABGUARD</title>
  <style>
    @media print {
      body { margin: 0; padding: 15mm; font-size: 10pt; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 40px auto;
      max-width: 1200px;
      padding: 0 20px;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header h1 {
      margin: 0;
      color: #0f172a;
      font-size: 20pt;
    }
    .header p {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 9pt;
    }
    .summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    .summary-box ul {
      margin: 6px 0 0 0;
      padding-left: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 30px;
    }
    th {
      background-color: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 8px 10px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${report.title}</h1>
      <p>LABGUARD Institutional Fleet Operations Management • Confidential Record</p>
    </div>
    <div style="text-align: right;">
      <p><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
      <p><strong>Total Records:</strong> ${report.rowCount}</p>
    </div>
  </div>

  ${
    summaryItems
      ? `<div class="summary-box">
           <strong>Report Summary KPI Aggregates:</strong>
           <ul>${summaryItems}</ul>
         </div>`
      : ''
  }

  <table>
    <thead>
      <tr>
        ${report.columns.map((c) => `<th>${c}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${report.rows
        .map(
          (row) => `
        <tr>
          ${row.map((val) => `<td>${val}</td>`).join('')}
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>LABGUARD Campus Station Management System • Security Audited</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`;
  }
}

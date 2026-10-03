// ============================================================================
// LABGUARD V2: Institutional Reporting Center (Phase 22: Reporting System)
// Multi-format report generator with live data preview and one-click
// export to CSV, Excel XML, and Printable PDF format.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { ApiClient, getApiBaseUrl } from '../services/api';
import {
  FileText,
  Download,
  Printer,
  Table,
  Calendar,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ReportTypeItem {
  id: string;
  title: string;
  description: string;
}

export const ReportingCenter: React.FC<{ defaultLab?: string }> = ({ defaultLab = 'ALL' }) => {
  const [reportTypes, setReportTypes] = useState<ReportTypeItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>('SESSION_HISTORY');
  const [labs, setLabs] = useState<any[]>([]);
  const [selectedLab, setSelectedLab] = useState<string>(defaultLab);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [loading, setLoading] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load available report types and laboratories
  useEffect(() => {
    const init = async () => {
      try {
        const [typesRes, labsRes] = await Promise.all([
          ApiClient.request('/reports/types'),
          ApiClient.request('/labs')
        ]);
        if (typesRes.success && typesRes.data) {
          setReportTypes(typesRes.data);
          if (typesRes.data.length > 0) {
            setSelectedType(typesRes.data[0].id);
          }
        }
        if (labsRes.success && labsRes.data) {
          setLabs(labsRes.data);
        }
      } catch (err) {
        console.error('Failed to load reporting metadata:', err);
      }
    };
    init();
  }, []);

  // Fetch report preview
  const handleGenerateReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await ApiClient.request('/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          reportType: selectedType,
          labCode: selectedLab !== 'ALL' ? selectedLab : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined
        })
      });

      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setErrorMsg(res.message || 'Failed to generate report preview');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  // Export report to CSV, Excel, or PDF
  const handleExport = async (format: 'CSV' | 'EXCEL' | 'PDF') => {
    setExportingFormat(format);
    try {
      const token = ApiClient.getToken();
      let query = `format=${format}`;
      if (selectedLab && selectedLab !== 'ALL') query += `&labCode=${encodeURIComponent(selectedLab)}`;
      if (startDate) query += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) query += `&endDate=${encodeURIComponent(endDate)}`;
      if (statusFilter && statusFilter !== 'ALL') query += `&status=${encodeURIComponent(statusFilter)}`;

      const url = `${getApiBaseUrl()}/reports/export/${selectedType}?${query}`;

      if (format === 'PDF') {
        // Open printable HTML view in new window for direct print dialog
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.focus();
        }
      } else {
        // Download file via authenticated blob
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const ext = format === 'CSV' ? 'csv' : 'xls';
        a.download = `Labguard_${selectedType}_${new Date().toISOString().slice(0, 10)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }
    } catch (err: any) {
      alert(`Export error: ${err.message || 'Failed to download report'}`);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Institutional Reporting &amp; Audit Exporter</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate audited session logs, workstation telemetry, facility utilization, and maintenance records
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('CSV')}
              disabled={exportingFormat !== null}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingFormat === 'CSV' ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            <button
              onClick={() => handleExport('EXCEL')}
              disabled={exportingFormat !== null}
              className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-emerald-200"
            >
              <Table className="w-3.5 h-3.5" />
              <span>{exportingFormat === 'EXCEL' ? 'Exporting...' : 'Export Excel (.xls)'}</span>
            </button>

            <button
              onClick={() => handleExport('PDF')}
              disabled={exportingFormat !== null}
              className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {/* Report Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Report Module</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
            >
              {reportTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.title}
                </option>
              ))}
            </select>
          </div>

          {/* Facility Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Facility / Lab</label>
            <select
              value={selectedLab}
              onChange={(e) => setSelectedLab(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="ALL">All Facilities</option>
              {labs.map((l) => (
                <option key={l.id} value={l.code}>
                  {l.code} - {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: Start */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Date Range: End */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Generate Button Row */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {reportTypes.find((r) => r.id === selectedType)?.description || 'Select report parameters above.'}
          </p>

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Generating...' : 'Preview Report'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Report Data Preview Table */}
      {reportData && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-4">
          {/* Summary KPIs */}
          {reportData.summary && Object.keys(reportData.summary).length > 0 && (
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Summary Metrics Overview
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                {Object.entries(reportData.summary).map(([key, val]) => (
                  <div key={key} className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase truncate">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{String(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold text-[10px]">
                <tr>
                  {reportData.columns.map((col: string, idx: number) => (
                    <th key={idx} className="px-4 py-3 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={reportData.columns.length}
                      className="px-4 py-8 text-center text-slate-400 font-medium"
                    >
                      No records matched the selected reporting filters.
                    </td>
                  </tr>
                ) : (
                  reportData.rows.map((row: any[], rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                      {row.map((cell: any, cIdx: number) => (
                        <td key={cIdx} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Total records retrieved: {reportData.rowCount}</span>
            <span>Generated: {new Date(reportData.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

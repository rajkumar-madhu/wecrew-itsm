/**
 * Incident Report Generator Component
 * WeCrew ITSM Platform
 *
 * - PDF download with professional formatting
 * - JSON export for integrations
 * - Section selector (choose what to include)
 * - Bulk report generation from incident list
 * - Quick inline download button (no modal)
 *
 * Adapted from blueprint to use lucide-react + plain CSS (no heroicons/framer-motion).
 */

import { useState, useCallback } from 'react';
import {
  FileDown,
  FileText,
  RefreshCw,
  CheckCircle2,
  X,
  Table2,
  ClipboardList,
  Printer,
  Share2,
  Code2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportSection {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  default: boolean;
}

type ReportFormat = 'pdf' | 'json';

interface IncidentReportGeneratorProps {
  incidentId: string;
  incidentNumber: string;
  className?: string;
}

interface BulkReportGeneratorProps {
  selectedIds: string[];
  className?: string;
  onComplete?: () => void;
}

interface QuickReportButtonProps {
  incidentId: string;
  incidentNumber: string;
  format?: ReportFormat;
  size?: 'sm' | 'md';
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REPORT_SECTIONS: ReportSection[] = [
  { id: 'summary',     label: 'Executive Summary',    description: 'Priority, impact, urgency, dates, people',          icon: ClipboardList, default: true },
  { id: 'description', label: 'Description & Details', description: 'Full incident description and CI details',           icon: FileText,      default: true },
  { id: 'sla',         label: 'SLA Compliance',        description: 'Response/resolution targets and breach status',      icon: Table2,        default: true },
  { id: 'timeline',    label: 'Activity Timeline',     description: 'Complete audit trail of all actions',               icon: RefreshCw,     default: true },
  { id: 'notes',       label: 'Work Notes',            description: 'All work notes and internal comments',              icon: FileText,      default: true },
  { id: 'related',     label: 'Related Items',         description: 'Linked changes, problems, alerts, attachments',     icon: Share2,        default: true },
];

const FORMAT_OPTIONS = [
  { id: 'pdf'  as ReportFormat, label: 'PDF Report',  description: 'Professional formatted PDF document', icon: FileDown },
  { id: 'json' as ReportFormat, label: 'JSON Export', description: 'Structured data for integrations',    icon: Code2    },
];

// ── Auth helper (matches wecrew-auth Zustand persist key) ─────────────────

function getAuthToken(): string {
  try {
    const stored = localStorage.getItem('wecrew-auth') || localStorage.getItem('linkedeye-auth');
    if (stored) return JSON.parse(stored).state?.token ?? '';
  } catch { /* ignore */ }
  return '';
}

// ── API helpers ───────────────────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1';

async function downloadReport(incidentId: string, format: ReportFormat, sections: string[]): Promise<Blob | object> {
  const url = `${API_BASE}/incidents/${incidentId}/report?format=${format}&sections=${sections.join(',')}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to generate report (${response.status})`);
  }
  return format === 'pdf' ? response.blob() : response.json();
}

async function downloadBulkReport(incidentIds: string[], format: ReportFormat): Promise<Blob | object> {
  const url = `${API_BASE}/incidents/bulk-report`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ incidentIds, format }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to generate bulk report (${response.status})`);
  }
  return format === 'pdf' ? response.blob() : response.json();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerJsonDownload(data: object, filename: string) {
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

// ── Single Incident Report Generator ─────────────────────────────────────────

export default function IncidentReportGenerator({
  incidentId,
  incidentNumber,
  className = '',
}: IncidentReportGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(REPORT_SECTIONS.filter(s => s.default).map(s => s.id))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggleSection = (id: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleGenerate = useCallback(async () => {
    if (selectedSections.size === 0) { toast.error('Select at least one section'); return; }
    setIsGenerating(true);
    setProgress(0);

    const interval = setInterval(() => setProgress(p => Math.min(p + 15, 85)), 300);

    try {
      const result = await downloadReport(incidentId, format, Array.from(selectedSections));
      clearInterval(interval);
      setProgress(100);

      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'pdf') {
        triggerDownload(result as Blob, `${incidentNumber}-report-${dateStr}.pdf`);
        toast.success(`Report downloaded: ${incidentNumber}-report-${dateStr}.pdf`);
      } else {
        triggerJsonDownload(result as object, `${incidentNumber}-report-${dateStr}.json`);
        toast.success(`JSON exported: ${incidentNumber}-report-${dateStr}.json`);
      }

      setTimeout(() => { setIsOpen(false); setProgress(0); }, 500);
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }, [incidentId, incidentNumber, format, selectedSections]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white',
          'hover:from-cyan-500 hover:to-cyan-600 hover:shadow-lg hover:shadow-cyan-500/25',
          'active:scale-[0.98]',
          className
        )}
      >
        <FileDown size={15} />
        Generate Report
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isGenerating && setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Generate Report</h2>
                <p className="text-sm text-gray-400 mt-0.5">{incidentNumber}</p>
              </div>
              <button
                onClick={() => !isGenerating && setIsOpen(false)}
                disabled={isGenerating}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Format */}
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Export Format</p>
                <div className="grid grid-cols-2 gap-3">
                  {FORMAT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setFormat(opt.id)}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                        format === opt.id
                          ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      )}
                    >
                      <opt.icon size={18} className={format === opt.id ? 'text-cyan-400' : 'text-gray-500'} />
                      <div className="text-left">
                        <p className={clsx('text-sm font-medium', format === opt.id ? 'text-cyan-400' : 'text-gray-300')}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-500">{opt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-300">Report Sections</p>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedSections(new Set(REPORT_SECTIONS.map(s => s.id)))} className="text-cyan-400 hover:text-cyan-300">
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button onClick={() => setSelectedSections(new Set())} className="text-gray-400 hover:text-gray-300">
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {REPORT_SECTIONS.map(section => {
                    const selected = selectedSections.has(section.id);
                    return (
                      <button
                        key={section.id}
                        onClick={() => toggleSection(section.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left',
                          selected ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                        )}
                      >
                        <div className={clsx(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          selected ? 'border-cyan-500 bg-cyan-500' : 'border-gray-600'
                        )}>
                          {selected && <CheckCircle2 size={11} className="text-ink" />}
                        </div>
                        <section.icon size={14} className={clsx('flex-shrink-0', selected ? 'text-cyan-400' : 'text-gray-500')} />
                        <div className="min-w-0">
                          <p className={clsx('text-sm font-medium', selected ? 'text-ink' : 'text-gray-400')}>{section.label}</p>
                          <p className="text-xs text-gray-500 truncate">{section.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isGenerating}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-ink transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || selectedSections.size === 0}
                  className="relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-ink overflow-hidden btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating && (
                    <div
                      className="absolute inset-0 bg-cyan-500/30 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {isGenerating
                      ? <><RefreshCw size={14} className="animate-spin" /> Generating... {progress}%</>
                      : <><FileDown size={14} /> Generate {format === 'pdf' ? 'PDF' : 'JSON'}</>
                    }
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Bulk Report Generator ─────────────────────────────────────────────────────

export function BulkReportGenerator({ selectedIds, className = '', onComplete }: BulkReportGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (selectedIds.length === 0) { toast.error('No incidents selected'); return; }
    setIsGenerating(true);
    try {
      const result = await downloadBulkReport(selectedIds, format);
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'pdf') {
        triggerDownload(result as Blob, `bulk-incident-report-${dateStr}.pdf`);
        toast.success(`Bulk PDF downloaded (${selectedIds.length} incidents)`);
      } else {
        triggerJsonDownload(result as object, `bulk-incident-report-${dateStr}.json`);
        toast.success(`Bulk JSON exported (${selectedIds.length} incidents)`);
      }
      setIsOpen(false);
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate bulk report');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedIds, format, onComplete]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={selectedIds.length === 0}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-200',
          selectedIds.length > 0
            ? 'bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700',
          className
        )}
      >
        <Printer size={14} />
        Bulk Report ({selectedIds.length})
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isGenerating && setIsOpen(false)}
          />
          <div className="relative bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-ink">Bulk Incident Report</h2>
              <p className="text-sm text-gray-400 mt-1">
                Generate a combined report for {selectedIds.length} selected incident{selectedIds.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    format === opt.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  )}
                >
                  <opt.icon size={18} className={format === opt.id ? 'text-cyan-400' : 'text-gray-500'} />
                  <p className={clsx('text-sm font-medium', format === opt.id ? 'text-cyan-400' : 'text-gray-300')}>
                    {opt.label}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isGenerating}
                className="px-4 py-2 text-sm text-gray-400 hover:text-ink transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-ink btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating
                  ? <><RefreshCw size={14} className="animate-spin" /> Generating...</>
                  : <><Printer size={14} /> Generate {format === 'pdf' ? 'PDF' : 'JSON'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Quick Download Button (inline, no modal) ──────────────────────────────────

export function QuickReportButton({
  incidentId,
  incidentNumber,
  format = 'pdf',
  size = 'md',
  className = '',
}: QuickReportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleQuickDownload = async () => {
    setIsLoading(true);
    try {
      const allSections = REPORT_SECTIONS.map(s => s.id);
      const result = await downloadReport(incidentId, format, allSections);
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'pdf') {
        triggerDownload(result as Blob, `${incidentNumber}-report-${dateStr}.pdf`);
      } else {
        triggerJsonDownload(result as object, `${incidentNumber}-report-${dateStr}.json`);
      }
      toast.success('Report downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download report');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleQuickDownload}
      disabled={isLoading}
      title={`Download ${format.toUpperCase()} Report`}
      className={clsx(
        'flex items-center gap-1.5 rounded-lg transition-all duration-200',
        'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10',
        'disabled:opacity-50 disabled:cursor-wait',
        size === 'sm' ? 'p-1.5' : 'px-3 py-1.5',
        className
      )}
    >
      {isLoading
        ? <RefreshCw size={size === 'sm' ? 14 : 16} className="animate-spin" />
        : <FileDown  size={size === 'sm' ? 14 : 16} />
      }
      {size === 'md' && <span className="text-xs">{format.toUpperCase()}</span>}
    </button>
  );
}

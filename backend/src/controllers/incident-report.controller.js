/**
 * Incident Report Generation Controller
 * LinkedEye-FinSpot ITSM Platform
 *
 * Generates professional PDF reports for incidents including:
 * - Executive Summary with severity indicators
 * - Full incident timeline & activity log
 * - Work notes history
 * - SLA compliance tracking
 * - Related items (changes, problems, alerts)
 * - Configuration item details
 * - Resolution details & root cause
 *
 * Dependencies: pdfkit (npm install pdfkit)
 * Route: GET /api/v1/incidents/:id/report
 * Route: GET /api/v1/incidents/:id/report?format=json (structured data)
 */

const PDFDocument = require('pdfkit');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { param, query } = require('express-validator');

// ═══════════════════════════════════════════════════════════════
// COLOR PALETTE — LinkedEye Brand
// ═══════════════════════════════════════════════════════════════
const COLORS = {
  primary: '#0891B2',      // Cyan-600
  primaryDark: '#155E75',  // Cyan-800
  secondary: '#7C3AED',   // Violet-600
  success: '#059669',      // Emerald-600
  warning: '#D97706',      // Amber-600
  danger: '#DC2626',       // Red-600
  info: '#2563EB',         // Blue-600
  dark: '#111827',         // Gray-900
  medium: '#4B5563',       // Gray-600
  light: '#9CA3AF',        // Gray-400
  lightest: '#F3F4F6',     // Gray-100
  white: '#FFFFFF',
  black: '#000000',
  tableBorder: '#D1D5DB',  // Gray-300
  tableHeader: '#0E7490',  // Cyan-700
  tableStripe: '#F0FDFA',  // Cyan-50
  slaGreen: '#10B981',
  slaRed: '#EF4444',
};

// Priority color mapping
const PRIORITY_COLORS = {
  P1: COLORS.danger,
  P2: COLORS.warning,
  P3: COLORS.info,
  P4: COLORS.success,
};

const PRIORITY_LABELS = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

// State color mapping
const STATE_COLORS = {
  NEW: COLORS.info,
  IN_PROGRESS: COLORS.secondary,
  ON_HOLD: COLORS.warning,
  RESOLVED: COLORS.success,
  CLOSED: COLORS.light,
  CANCELLED: COLORS.danger,
};

// Impact/Urgency labels
const IMPACT_LABELS = {
  CRITICAL: 'Enterprise-wide',
  HIGH: 'Multiple departments',
  MEDIUM: 'Single department',
  LOW: 'Individual user',
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Format date to readable string
 */
function formatDate(date, includeTime = true) {
  if (!date) return 'N/A';
  const d = new Date(date);
  const options = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...(includeTime && { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
  return d.toLocaleDateString('en-IN', options);
}

/**
 * Calculate duration between two dates
 */
function calculateDuration(start, end) {
  if (!start || !end) return 'N/A';
  const diffMs = new Date(end) - new Date(start);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h ${mins}m`;
}

/**
 * Truncate text to max length
 */
function truncate(text, maxLen = 100) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen - 3) + '...' : text;
}

/**
 * Get SLA status text
 */
function getSLAStatus(incident) {
  if (incident.slaBreached) return { text: 'BREACHED', color: COLORS.danger };
  if (incident.state === 'CLOSED' || incident.state === 'RESOLVED') {
    return { text: 'MET', color: COLORS.success };
  }
  // Check if approaching breach
  if (incident.slaTargetResolution) {
    const remaining = new Date(incident.slaTargetResolution) - new Date();
    if (remaining < 3600000) return { text: 'AT RISK', color: COLORS.warning };
  }
  return { text: 'ON TRACK', color: COLORS.success };
}

// ═══════════════════════════════════════════════════════════════
// PDF DOCUMENT BUILDER CLASS
// ═══════════════════════════════════════════════════════════════
class IncidentReportBuilder {
  constructor(doc, incident) {
    this.doc = doc;
    this.incident = incident;
    this.pageWidth = 595.28; // A4 width in points
    this.pageHeight = 841.89; // A4 height
    this.margin = 50;
    this.contentWidth = this.pageWidth - (this.margin * 2);
    this.currentY = 0;
    this.pageNumber = 1;
    this.totalPages = 0;
  }

  // ─── Page Header/Footer ─────────────────────────────────────
  addPageHeader() {
    const doc = this.doc;
    const y = 30;

    // Top bar
    doc.rect(0, 0, this.pageWidth, 8).fill(COLORS.primary);

    // Logo area
    doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.primaryDark)
      .text('LinkedEye', this.margin, y);
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.light)
      .text('ITSM Platform', this.margin, y + 18);

    // Report title - right side
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.dark)
      .text('INCIDENT REPORT', this.pageWidth - this.margin - 120, y, { width: 120, align: 'right' });
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.medium)
      .text(this.incident.number, this.pageWidth - this.margin - 120, y + 13, { width: 120, align: 'right' });

    // Separator
    doc.moveTo(this.margin, y + 30).lineTo(this.pageWidth - this.margin, y + 30)
      .strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();

    this.currentY = y + 40;
  }

  addPageFooter() {
    const doc = this.doc;
    const y = this.pageHeight - 40;

    // Separator
    doc.moveTo(this.margin, y).lineTo(this.pageWidth - this.margin, y)
      .strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();

    // Left: Classification
    doc.fontSize(6).font('Helvetica').fillColor(COLORS.light)
      .text('CONFIDENTIAL — Internal Use Only', this.margin, y + 8);

    // Center: Generated timestamp
    doc.fontSize(6).font('Helvetica').fillColor(COLORS.light)
      .text(`Generated: ${formatDate(new Date())}`, 0, y + 8, { width: this.pageWidth, align: 'center' });

    // Right: Page number
    doc.fontSize(6).font('Helvetica').fillColor(COLORS.light)
      .text(`Page ${this.pageNumber}`, this.pageWidth - this.margin - 60, y + 8, { width: 60, align: 'right' });
  }

  checkPageBreak(requiredHeight = 100) {
    if (this.currentY + requiredHeight > this.pageHeight - 60) {
      this.addPageFooter();
      this.doc.addPage();
      this.pageNumber++;
      this.addPageHeader();
      return true;
    }
    return false;
  }

  // ─── Section Title ──────────────────────────────────────────
  addSectionTitle(title, icon = '●') {
    this.checkPageBreak(40);
    const doc = this.doc;
    const y = this.currentY;

    // Section background bar
    doc.rect(this.margin, y, this.contentWidth, 24)
      .fill(COLORS.primaryDark);

    // Icon + Title
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.white)
      .text(`${icon}  ${title.toUpperCase()}`, this.margin + 10, y + 7);

    this.currentY = y + 32;
  }

  // ─── Key-Value Row ──────────────────────────────────────────
  addKeyValue(label, value, options = {}) {
    this.checkPageBreak(20);
    const doc = this.doc;
    const y = this.currentY;
    const { color = COLORS.dark, bold = false, indent = 0 } = options;

    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.medium)
      .text(label + ':', this.margin + indent, y, { width: 140, continued: false });

    doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color)
      .text(value || 'N/A', this.margin + 150 + indent, y, { width: this.contentWidth - 160 - indent });

    this.currentY = y + 16;
  }

  // ─── Inline Badge ───────────────────────────────────────────
  addBadge(text, bgColor, textColor = COLORS.white) {
    const doc = this.doc;
    const width = doc.widthOfString(text, { fontSize: 7 }) + 12;
    const x = doc.x;
    const y = this.currentY;

    doc.roundedRect(x, y, width, 14, 3).fill(bgColor);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(textColor)
      .text(text, x + 6, y + 3);

    return width;
  }

  // ─── Table ──────────────────────────────────────────────────
  addTable(headers, rows, options = {}) {
    const doc = this.doc;
    const { colWidths = null, stripeRows = true } = options;

    // Calculate column widths
    const numCols = headers.length;
    const defaultWidth = this.contentWidth / numCols;
    const widths = colWidths || headers.map(() => defaultWidth);

    // Header row
    this.checkPageBreak(60);
    let y = this.currentY;
    let x = this.margin;

    doc.rect(x, y, this.contentWidth, 20).fill(COLORS.tableHeader);
    headers.forEach((header, i) => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.white)
        .text(header, x + 6, y + 6, { width: widths[i] - 12 });
      x += widths[i];
    });
    y += 20;

    // Data rows
    rows.forEach((row, rowIdx) => {
      // Estimate row height
      const rowHeight = 18;
      if (y + rowHeight > this.pageHeight - 60) {
        this.addPageFooter();
        doc.addPage();
        this.pageNumber++;
        this.addPageHeader();
        y = this.currentY;

        // Re-draw header
        x = this.margin;
        doc.rect(x, y, this.contentWidth, 20).fill(COLORS.tableHeader);
        headers.forEach((header, i) => {
          doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.white)
            .text(header, x + 6, y + 6, { width: widths[i] - 12 });
          x += widths[i];
        });
        y += 20;
      }

      // Stripe background
      if (stripeRows && rowIdx % 2 === 0) {
        doc.rect(this.margin, y, this.contentWidth, rowHeight).fill(COLORS.tableStripe);
      }

      // Border
      doc.rect(this.margin, y, this.contentWidth, rowHeight)
        .strokeColor(COLORS.tableBorder).lineWidth(0.3).stroke();

      // Cell content
      x = this.margin;
      row.forEach((cell, colIdx) => {
        const cellStr = cell != null ? String(cell) : '';
        doc.fontSize(7).font('Helvetica').fillColor(COLORS.dark)
          .text(truncate(cellStr, 60), x + 6, y + 5, { width: widths[colIdx] - 12 });
        x += widths[colIdx];
      });
      y += rowHeight;
    });

    this.currentY = y + 8;
  }

  // ─── Multi-line Text Block ──────────────────────────────────
  addTextBlock(text, options = {}) {
    if (!text) return;
    const doc = this.doc;
    const { fontSize = 8, color = COLORS.dark, indent = 0 } = options;

    this.checkPageBreak(40);

    doc.fontSize(fontSize).font('Helvetica').fillColor(color)
      .text(text, this.margin + indent, this.currentY, {
        width: this.contentWidth - indent,
        lineGap: 3,
      });

    this.currentY = doc.y + 8;
  }

  // ─── Spacer ─────────────────────────────────────────────────
  addSpacer(height = 12) {
    this.currentY += height;
  }

  // ─── Horizontal Rule ───────────────────────────────────────
  addHR() {
    this.doc.moveTo(this.margin, this.currentY)
      .lineTo(this.pageWidth - this.margin, this.currentY)
      .strokeColor(COLORS.tableBorder).lineWidth(0.3).stroke();
    this.currentY += 8;
  }

  // ═══════════════════════════════════════════════════════════
  // REPORT SECTIONS
  // ═══════════════════════════════════════════════════════════

  buildCoverBanner() {
    const doc = this.doc;
    const inc = this.incident;
    const y = this.currentY;

    // Large banner
    const bannerHeight = 100;
    const priorityColor = PRIORITY_COLORS[inc.priority] || COLORS.info;

    // Priority stripe on left
    doc.rect(this.margin, y, 6, bannerHeight).fill(priorityColor);

    // Background
    doc.rect(this.margin + 6, y, this.contentWidth - 6, bannerHeight)
      .fill(COLORS.lightest);

    // Incident Number
    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.dark)
      .text(inc.number, this.margin + 20, y + 12);

    // Priority badge
    const prioText = `${inc.priority} — ${PRIORITY_LABELS[inc.priority] || inc.priority}`;
    doc.roundedRect(this.margin + 20, y + 42, doc.widthOfString(prioText, { fontSize: 8 }) + 16, 18, 3)
      .fill(priorityColor);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.white)
      .text(prioText, this.margin + 28, y + 47);

    // State badge
    const stateColor = STATE_COLORS[inc.state] || COLORS.medium;
    const stateText = inc.state.replace('_', ' ');
    const stateX = this.margin + 36 + doc.widthOfString(prioText, { fontSize: 8 }) + 16;
    doc.roundedRect(stateX, y + 42, doc.widthOfString(stateText, { fontSize: 8 }) + 16, 18, 3)
      .fill(stateColor);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.white)
      .text(stateText, stateX + 8, y + 47);

    // SLA indicator
    const sla = getSLAStatus(inc);
    const slaX = this.pageWidth - this.margin - 80;
    doc.roundedRect(slaX, y + 42, 70, 18, 3).fill(sla.color);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.white)
      .text(`SLA: ${sla.text}`, slaX + 6, y + 47, { width: 58, align: 'center' });

    // Short description
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.medium)
      .text(inc.shortDescription, this.margin + 20, y + 70, { width: this.contentWidth - 40 });

    this.currentY = y + bannerHeight + 12;
  }

  buildExecutiveSummary() {
    const inc = this.incident;

    this.addSectionTitle('Executive Summary', '◆');

    // Two-column layout for key details
    const col1X = this.margin;
    const col2X = this.margin + this.contentWidth / 2;
    const colWidth = this.contentWidth / 2 - 10;
    let y = this.currentY;

    const doc = this.doc;

    // Left column
    const leftItems = [
      ['Impact', inc.impact, IMPACT_LABELS[inc.impact]],
      ['Urgency', inc.urgency],
      ['Category', inc.category || 'Uncategorized'],
      ['Subcategory', inc.subcategory || 'N/A'],
      ['Source', inc.source],
    ];

    leftItems.forEach(([label, value, extra]) => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.medium)
        .text(label, col1X + 10, y);
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.dark)
        .text(extra ? `${value} (${extra})` : (value || 'N/A'), col1X + 100, y, { width: colWidth - 100 });
      y += 15;
    });

    // Right column
    y = this.currentY;
    const rightItems = [
      ['Created', formatDate(inc.createdAt)],
      ['Last Updated', formatDate(inc.updatedAt)],
      ['Resolved At', formatDate(inc.resolvedAt)],
      ['Closed At', formatDate(inc.closedAt)],
      ['Duration', calculateDuration(inc.createdAt, inc.resolvedAt || inc.closedAt || new Date())],
    ];

    rightItems.forEach(([label, value]) => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.medium)
        .text(label, col2X + 10, y);
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.dark)
        .text(value || 'N/A', col2X + 100, y, { width: colWidth - 100 });
      y += 15;
    });

    this.currentY = y + 8;
  }

  buildPeopleSection() {
    const inc = this.incident;

    this.addSectionTitle('People & Assignments', '◆');

    this.addKeyValue('Created By',
      inc.createdBy ? `${inc.createdBy.firstName} ${inc.createdBy.lastName} (${inc.createdBy.email})` : 'System');

    this.addKeyValue('Assigned To',
      inc.assignedTo ? `${inc.assignedTo.firstName} ${inc.assignedTo.lastName} (${inc.assignedTo.email})` : 'Unassigned');

    if (inc.assignedTo?.phone) {
      this.addKeyValue('Contact Phone', inc.assignedTo.phone);
    }

    this.addKeyValue('Assignment Group',
      inc.assignmentGroup ? `${inc.assignmentGroup.name}${inc.assignmentGroup.email ? ' — ' + inc.assignmentGroup.email : ''}` : 'None');

    if (inc.assignmentGroup?.slackChannel) {
      this.addKeyValue('Slack Channel', inc.assignmentGroup.slackChannel);
    }
  }

  buildDescriptionSection() {
    const inc = this.incident;

    this.addSectionTitle('Description & Details', '◆');

    this.addKeyValue('Short Description', inc.shortDescription, { bold: true });
    this.addSpacer(4);

    if (inc.description) {
      this.doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.medium)
        .text('Full Description:', this.margin, this.currentY);
      this.currentY += 12;
      this.addTextBlock(inc.description, { indent: 10 });
    }
  }

  buildConfigItemSection() {
    const inc = this.incident;
    if (!inc.configItem) return;

    this.addSectionTitle('Configuration Item', '◆');

    const ci = inc.configItem;
    this.addKeyValue('CI Name', ci.name, { bold: true });
    this.addKeyValue('CI Type', ci.type);
    this.addKeyValue('Status', ci.status);
    if (ci.ipAddress) this.addKeyValue('IP Address', ci.ipAddress);
    if (ci.hostname) this.addKeyValue('Hostname', ci.hostname);
    if (ci.location) this.addKeyValue('Location', ci.location);
    if (ci.prometheusJob) this.addKeyValue('Prometheus Job', ci.prometheusJob);
    if (ci.grafanaDashboard) this.addKeyValue('Grafana Dashboard', ci.grafanaDashboard);
  }

  buildSLASection() {
    const inc = this.incident;

    this.addSectionTitle('SLA Compliance', '◆');

    const sla = getSLAStatus(inc);

    // SLA Status box
    const doc = this.doc;
    const y = this.currentY;
    const boxHeight = 50;

    doc.rect(this.margin, y, this.contentWidth, boxHeight)
      .fillAndStroke(sla.color === COLORS.danger ? '#FEF2F2' : '#F0FDF4',
        sla.color === COLORS.danger ? '#FECACA' : '#BBF7D0');

    doc.fontSize(12).font('Helvetica-Bold').fillColor(sla.color)
      .text(`SLA STATUS: ${sla.text}`, 0, y + 8, { width: this.pageWidth, align: 'center' });

    if (inc.slaBreached) {
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.danger)
        .text('⚠ This incident has breached its SLA targets', 0, y + 28, { width: this.pageWidth, align: 'center' });
    }

    this.currentY = y + boxHeight + 10;

    // SLA Details table
    const headers = ['SLA Metric', 'Target', 'Actual', 'Status'];
    const rows = [];

    // Response SLA
    const responseActual = inc.responseTime ? formatDate(inc.responseTime) : 'Pending';
    const responseTarget = inc.slaTargetResponse ? formatDate(inc.slaTargetResponse) : 'N/A';
    const responseMet = inc.responseTime && inc.slaTargetResponse
      ? new Date(inc.responseTime) <= new Date(inc.slaTargetResponse) ? 'MET' : 'BREACHED'
      : 'IN PROGRESS';
    rows.push(['Response Time', responseTarget, responseActual, responseMet]);

    // Resolution SLA
    const resolutionActual = inc.resolvedAt ? formatDate(inc.resolvedAt) : 'Pending';
    const resolutionTarget = inc.slaTargetResolution ? formatDate(inc.slaTargetResolution) : 'N/A';
    const resolutionMet = inc.resolvedAt && inc.slaTargetResolution
      ? new Date(inc.resolvedAt) <= new Date(inc.slaTargetResolution) ? 'MET' : 'BREACHED'
      : 'IN PROGRESS';
    rows.push(['Resolution Time', resolutionTarget, resolutionActual, resolutionMet]);

    // Total duration
    rows.push([
      'Total Duration',
      'N/A',
      calculateDuration(inc.createdAt, inc.resolvedAt || inc.closedAt || new Date()),
      inc.state === 'CLOSED' || inc.state === 'RESOLVED' ? 'COMPLETE' : 'ONGOING'
    ]);

    this.addTable(headers, rows, {
      colWidths: [130, 130, 130, 105],
    });
  }

  buildResolutionSection() {
    const inc = this.incident;
    if (!inc.resolutionCode && !inc.resolutionNotes) return;

    this.addSectionTitle('Resolution', '◆');

    if (inc.resolutionCode) {
      this.addKeyValue('Resolution Code', inc.resolutionCode, { bold: true, color: COLORS.success });
    }
    if (inc.resolvedAt) {
      this.addKeyValue('Resolved At', formatDate(inc.resolvedAt));
      this.addKeyValue('Time to Resolve', calculateDuration(inc.createdAt, inc.resolvedAt));
    }
    if (inc.resolutionNotes) {
      this.addSpacer(4);
      this.doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.medium)
        .text('Resolution Notes:', this.margin, this.currentY);
      this.currentY += 12;
      this.addTextBlock(inc.resolutionNotes, { indent: 10 });
    }
  }

  buildActivityTimeline() {
    const inc = this.incident;
    if (!inc.activities || inc.activities.length === 0) return;

    this.addSectionTitle('Activity Timeline', '◆');

    const headers = ['Timestamp', 'Action', 'Description'];
    const rows = inc.activities.map(activity => [
      formatDate(activity.createdAt),
      activity.action,
      truncate(activity.description, 80),
    ]);

    this.addTable(headers, rows, {
      colWidths: [130, 100, 265],
    });
  }

  buildWorkNotesSection() {
    const inc = this.incident;
    if (!inc.workNotes || inc.workNotes.length === 0) return;

    this.addSectionTitle('Work Notes', '◆');

    inc.workNotes.forEach((note, idx) => {
      this.checkPageBreak(60);

      const doc = this.doc;
      const y = this.currentY;

      // Note header
      const author = note.author
        ? `${note.author.firstName} ${note.author.lastName}`
        : 'System';
      const time = formatDate(note.createdAt);
      const badge = note.isInternal ? ' [INTERNAL]' : '';

      doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text(`#${idx + 1} — ${author}${badge}`, this.margin + 10, y);
      doc.fontSize(6).font('Helvetica').fillColor(COLORS.light)
        .text(time, this.pageWidth - this.margin - 130, y, { width: 120, align: 'right' });

      this.currentY = y + 14;

      // Note content
      doc.rect(this.margin + 10, this.currentY, this.contentWidth - 20, 1)
        .fill(COLORS.tableBorder);
      this.currentY += 4;

      this.addTextBlock(note.content, { indent: 10, fontSize: 7.5 });
      this.addSpacer(4);
    });
  }

  buildRelatedAlertsSection() {
    const inc = this.incident;
    if (!inc.relatedAlerts || inc.relatedAlerts.length === 0) return;

    this.addSectionTitle('Related Alerts', '◆');

    const headers = ['Alert Name', 'Severity', 'Fired At', 'Status'];
    const rows = inc.relatedAlerts.map(alert => [
      truncate(alert.alertName || alert.name || 'Unknown', 50),
      alert.severity || 'N/A',
      formatDate(alert.firedAt),
      alert.status || alert.state || 'N/A',
    ]);

    this.addTable(headers, rows, {
      colWidths: [180, 80, 130, 105],
    });
  }

  buildLinkedItemsSection() {
    const inc = this.incident;
    const hasChanges = inc.linkedChanges && inc.linkedChanges.length > 0;
    const hasProblems = inc.linkedProblems && inc.linkedProblems.length > 0;
    if (!hasChanges && !hasProblems) return;

    this.addSectionTitle('Linked Items', '◆');

    if (hasChanges) {
      this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.dark)
        .text('Linked Changes:', this.margin + 10, this.currentY);
      this.currentY += 14;

      const headers = ['Change #', 'Description', 'State', 'Link Type'];
      const rows = inc.linkedChanges.map(lc => [
        lc.change?.number || 'N/A',
        truncate(lc.change?.shortDescription || '', 50),
        lc.change?.state || 'N/A',
        lc.linkType || 'RELATED',
      ]);

      this.addTable(headers, rows, {
        colWidths: [100, 200, 95, 100],
      });
    }

    if (hasProblems) {
      this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.dark)
        .text('Linked Problems:', this.margin + 10, this.currentY);
      this.currentY += 14;

      const headers = ['Problem #', 'Description', 'State', 'Link Type'];
      const rows = inc.linkedProblems.map(lp => [
        lp.problem?.number || 'N/A',
        truncate(lp.problem?.shortDescription || '', 50),
        lp.problem?.state || 'N/A',
        lp.linkType || 'RELATED',
      ]);

      this.addTable(headers, rows, {
        colWidths: [100, 200, 95, 100],
      });
    }
  }

  buildAttachmentsSection() {
    const inc = this.incident;
    if (!inc.attachments || inc.attachments.length === 0) return;

    this.addSectionTitle('Attachments', '◆');

    const headers = ['File Name', 'Type', 'Size', 'Uploaded'];
    const rows = inc.attachments.map(att => [
      att.fileName || att.name || 'Unknown',
      att.mimeType || att.type || 'N/A',
      att.size ? `${Math.round(att.size / 1024)} KB` : 'N/A',
      formatDate(att.createdAt),
    ]);

    this.addTable(headers, rows, {
      colWidths: [180, 120, 80, 115],
    });
  }

  buildSourceAlertSection() {
    const inc = this.incident;
    if (!inc.sourceAlertId && !inc.sourceAlertName) return;

    this.addSectionTitle('Source Alert Information', '◆');

    if (inc.sourceAlertId) this.addKeyValue('Source Alert ID', inc.sourceAlertId);
    if (inc.sourceAlertName) this.addKeyValue('Source Alert Name', inc.sourceAlertName);
    this.addKeyValue('Source Type', inc.source);
  }

  buildSignatureBlock() {
    this.checkPageBreak(80);
    const doc = this.doc;
    const y = this.currentY + 20;

    doc.moveTo(this.margin, y).lineTo(this.pageWidth - this.margin, y)
      .strokeColor(COLORS.primaryDark).lineWidth(1).stroke();

    this.currentY = y + 10;

    doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.medium)
      .text('Report generated by LinkedEye ITSM Platform', this.margin, this.currentY);
    this.currentY += 12;
    doc.fontSize(6).font('Helvetica').fillColor(COLORS.light)
      .text('This is an auto-generated report. For official records, please verify with the incident management team.', this.margin, this.currentY);
    this.currentY += 10;
    doc.fontSize(6).font('Helvetica').fillColor(COLORS.light)
      .text(`Report ID: RPT-${this.incident.number}-${Date.now().toString(36).toUpperCase()}`, this.margin, this.currentY);
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN BUILD
  // ═══════════════════════════════════════════════════════════
  build() {
    this.addPageHeader();
    this.buildCoverBanner();
    this.addSpacer(8);
    this.buildExecutiveSummary();
    this.buildPeopleSection();
    this.buildDescriptionSection();
    this.buildConfigItemSection();
    this.buildSLASection();
    this.buildResolutionSection();
    this.buildActivityTimeline();
    this.buildWorkNotesSection();
    this.buildRelatedAlertsSection();
    this.buildLinkedItemsSection();
    this.buildAttachmentsSection();
    this.buildSourceAlertSection();
    this.buildSignatureBlock();
    this.addPageFooter();
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTROLLER METHODS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate Incident Report (PDF)
 * GET /api/v1/incidents/:id/report
 *
 * Query params:
 *   format=pdf (default) | json
 *   sections=all (default) | summary,timeline,notes,sla,related
 */
exports.generateIncidentReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'pdf', sections = 'all' } = req.query;

    // Fetch complete incident data
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, avatar: true, phone: true
          }
        },
        assignmentGroup: {
          select: { id: true, name: true, email: true, slackChannel: true }
        },
        configItem: {
          select: {
            id: true, name: true, type: true, status: true,
            ipAddress: true, hostname: true, location: true,
            prometheusJob: true, grafanaDashboard: true
          }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        workNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          }
        },
        relatedAlerts: {
          orderBy: { firedAt: 'desc' },
          take: 20
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        attachments: true,
        linkedChanges: {
          include: {
            change: {
              select: { number: true, shortDescription: true, state: true }
            }
          }
        },
        linkedProblems: {
          include: {
            problem: {
              select: { number: true, shortDescription: true, state: true }
            }
          }
        }
      }
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: `Incident with ID ${id} not found`
      });
    }

    // JSON format - return structured report data
    if (format === 'json') {
      return res.json({
        success: true,
        data: {
          reportId: `RPT-${incident.number}-${Date.now().toString(36).toUpperCase()}`,
          generatedAt: new Date().toISOString(),
          generatedBy: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'System',
          incident: {
            ...incident,
            slaStatus: getSLAStatus(incident),
            totalDuration: calculateDuration(incident.createdAt, incident.resolvedAt || incident.closedAt || new Date()),
            priorityLabel: PRIORITY_LABELS[incident.priority] || incident.priority,
            impactLabel: IMPACT_LABELS[incident.impact] || incident.impact,
          }
        }
      });
    }

    // PDF format - generate and stream PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Incident Report — ${incident.number}`,
        Author: 'LinkedEye ITSM Platform',
        Subject: incident.shortDescription,
        Keywords: `incident, ${incident.number}, ${incident.priority}, ${incident.state}`,
        Creator: 'LinkedEye Report Generator v1.0',
        Producer: 'PDFKit',
        CreationDate: new Date(),
      },
      autoFirstPage: true,
      bufferPages: true,
    });

    // Set response headers
    const filename = `${incident.number}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    // Pipe PDF to response
    doc.pipe(res);

    // Build the report
    const builder = new IncidentReportBuilder(doc, incident);
    builder.build();

    // Finalize PDF
    doc.end();

    // Log report generation
    logger.info(`Incident report generated: ${incident.number} by ${req.user?.email || 'system'}`);

    // Create activity log
    try {
      await prisma.activity.create({
        data: {
          incidentId: id,
          action: 'REPORT_GENERATED',
          description: `PDF report generated by ${req.user?.firstName || 'System'} ${req.user?.lastName || ''}`.trim(),
          userId: req.user?.id,
        }
      });
    } catch (activityError) {
      logger.warn('Failed to log report generation activity:', activityError.message);
    }

  } catch (error) {
    logger.error('Generate incident report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate incident report'
    });
  }
};

/**
 * Generate Bulk Incident Report
 * POST /api/v1/incidents/bulk-report
 * Body: { incidentIds: string[], format: 'pdf' | 'json' }
 */
exports.generateBulkReport = async (req, res) => {
  try {
    const { incidentIds, format = 'json' } = req.body;

    if (!incidentIds || !Array.isArray(incidentIds) || incidentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'incidentIds array is required'
      });
    }

    if (incidentIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 incidents per bulk report'
      });
    }

    const incidents = await prisma.incident.findMany({
      where: { id: { in: incidentIds } },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        assignmentGroup: {
          select: { id: true, name: true }
        },
        configItem: {
          select: { id: true, name: true, type: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      return res.json({
        success: true,
        data: {
          reportId: `BULK-RPT-${Date.now().toString(36).toUpperCase()}`,
          generatedAt: new Date().toISOString(),
          totalIncidents: incidents.length,
          incidents: incidents.map(inc => ({
            id: inc.id,
            number: inc.number,
            shortDescription: inc.shortDescription,
            state: inc.state,
            priority: inc.priority,
            priorityLabel: PRIORITY_LABELS[inc.priority],
            impact: inc.impact,
            urgency: inc.urgency,
            slaBreached: inc.slaBreached,
            slaStatus: getSLAStatus(inc),
            assignedTo: inc.assignedTo
              ? `${inc.assignedTo.firstName} ${inc.assignedTo.lastName}`
              : 'Unassigned',
            assignmentGroup: inc.assignmentGroup?.name || 'None',
            configItem: inc.configItem?.name || 'None',
            createdBy: `${inc.createdBy.firstName} ${inc.createdBy.lastName}`,
            createdAt: inc.createdAt,
            resolvedAt: inc.resolvedAt,
            closedAt: inc.closedAt,
            duration: calculateDuration(inc.createdAt, inc.resolvedAt || inc.closedAt || new Date()),
          })),
          summary: {
            byPriority: {
              P1: incidents.filter(i => i.priority === 'P1').length,
              P2: incidents.filter(i => i.priority === 'P2').length,
              P3: incidents.filter(i => i.priority === 'P3').length,
              P4: incidents.filter(i => i.priority === 'P4').length,
            },
            byState: incidents.reduce((acc, i) => {
              acc[i.state] = (acc[i.state] || 0) + 1;
              return acc;
            }, {}),
            slaBreached: incidents.filter(i => i.slaBreached).length,
            avgDurationMins: Math.round(
              incidents
                .filter(i => i.resolvedAt)
                .reduce((acc, i) => acc + (new Date(i.resolvedAt) - new Date(i.createdAt)) / 60000, 0)
              / Math.max(incidents.filter(i => i.resolvedAt).length, 1)
            ),
          }
        }
      });
    }

    // PDF bulk report
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Bulk Incident Report',
        Author: 'LinkedEye ITSM Platform',
        Creator: 'LinkedEye Report Generator v1.0',
      },
    });

    const filename = `bulk-incident-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Cover page
    doc.rect(0, 0, 595.28, 8).fill(COLORS.primary);
    doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.primaryDark)
      .text('LinkedEye', 50, 50);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.light)
      .text('ITSM Platform — Bulk Incident Report', 50, 78);

    doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.dark)
      .text('Incident Summary Report', 50, 120);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.medium)
      .text(`Generated: ${formatDate(new Date())}`, 50, 145);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.medium)
      .text(`Total Incidents: ${incidents.length}`, 50, 162);

    // Summary table
    let y = 200;
    const headers = ['#', 'Number', 'Description', 'Priority', 'State', 'SLA', 'Duration'];
    const colWidths = [25, 75, 170, 55, 70, 50, 50];
    const contentWidth = 495.28;
    let x = 50;

    // Table header
    doc.rect(x, y, contentWidth, 20).fill(COLORS.tableHeader);
    headers.forEach((h, i) => {
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(COLORS.white)
        .text(h, x + 4, y + 6, { width: colWidths[i] - 8 });
      x += colWidths[i];
    });
    y += 20;

    // Table rows
    incidents.forEach((inc, idx) => {
      if (y > 780) {
        doc.addPage();
        doc.rect(0, 0, 595.28, 8).fill(COLORS.primary);
        y = 30;
        // Re-draw header
        x = 50;
        doc.rect(x, y, contentWidth, 20).fill(COLORS.tableHeader);
        headers.forEach((h, i) => {
          doc.fontSize(6.5).font('Helvetica-Bold').fillColor(COLORS.white)
            .text(h, x + 4, y + 6, { width: colWidths[i] - 8 });
          x += colWidths[i];
        });
        y += 20;
      }

      if (idx % 2 === 0) {
        doc.rect(50, y, contentWidth, 16).fill(COLORS.tableStripe);
      }
      doc.rect(50, y, contentWidth, 16).strokeColor(COLORS.tableBorder).lineWidth(0.3).stroke();

      const sla = getSLAStatus(inc);
      const duration = calculateDuration(inc.createdAt, inc.resolvedAt || new Date());
      const rowData = [
        String(idx + 1),
        inc.number,
        truncate(inc.shortDescription, 35),
        inc.priority,
        inc.state.replace('_', ' '),
        sla.text,
        duration,
      ];

      x = 50;
      rowData.forEach((cell, i) => {
        const color = i === 3 ? (PRIORITY_COLORS[cell] || COLORS.dark) : COLORS.dark;
        doc.fontSize(6.5).font('Helvetica').fillColor(color)
          .text(cell, x + 4, y + 4, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });
      y += 16;
    });

    doc.end();
    logger.info(`Bulk incident report generated: ${incidents.length} incidents`);

  } catch (error) {
    logger.error('Generate bulk report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate bulk report'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// VALIDATION & ROUTE EXPORTS
// ═══════════════════════════════════════════════════════════════

exports.reportValidation = [
  param('id').isUUID().withMessage('Invalid incident ID'),
  query('format').optional().isIn(['pdf', 'json']).withMessage('Format must be pdf or json'),
  query('sections').optional().isString(),
];

exports.bulkReportValidation = [
  // Body validation handled in controller
];

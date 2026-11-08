import { UserReport } from '../types';

/**
 * Escapes CSV cell string values safely according to RFC 4180
 */
function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates and downloads a CSV file for Incident Reports
 */
export function downloadReportsCSV(reports: UserReport[], exportedByName: string): void {
  const headers = [
    'Report ID',
    'Category',
    'Subject',
    'Author Name',
    'Author Email',
    'Author UID',
    'Status',
    'Submitted Date',
    'Last Updated',
    'Evidence Link',
    'Description',
    'Resolution Notes',
  ];

  const rows = reports.map((r) => [
    escapeCsvCell(r.id),
    escapeCsvCell(r.reportType),
    escapeCsvCell(r.subject),
    escapeCsvCell(r.authorName),
    escapeCsvCell(r.authorEmail),
    escapeCsvCell(r.authorUid),
    escapeCsvCell(r.status),
    escapeCsvCell(new Date(r.createdAt).toLocaleString()),
    escapeCsvCell(new Date(r.updatedAt || r.createdAt).toLocaleString()),
    escapeCsvCell(r.evidenceUrl || 'N/A'),
    escapeCsvCell(r.description),
    escapeCsvCell(r.resolutionNotes || 'None'),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.setAttribute('href', url);
  link.setAttribute('download', `flick_incident_reports_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a clean, print-ready PDF document window for external team review
 */
export function openReportsPDFPrintWindow(reports: UserReport[], exportedByName: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups in your browser to view and download the PDF report.');
    return;
  }

  const exportDate = new Date().toLocaleString();
  const openCount = reports.filter((r) => r.status === 'Open').length;
  const reviewCount = reports.filter((r) => r.status === 'Under Review' || r.status === 'Reviewing').length;
  const resolvedCount = reports.filter((r) => r.status === 'Resolved').length;
  const dismissedCount = reports.filter((r) => r.status === 'Dismissed' || r.status === 'Rejected').length;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>FLICK Community Incident Reports - External Review PDF</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 11px;
      line-height: 1.5;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #0284c7;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    .kpi-num {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .print-actions {
      margin-bottom: 20px;
      padding: 12px 16px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 800;
      cursor: pointer;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: left;
      padding: 8px;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      font-size: 10px;
    }
    tr:nth-child(even) { background: #f8fafc; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-open { background: #fef3c7; color: #92400e; }
    .badge-review { background: #e0f2fe; color: #075985; }
    .badge-resolved { background: #dcfce7; color: #166534; }
    .badge-dismissed { background: #f1f5f9; color: #475569; }
    .desc-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 10px;
      white-space: pre-line;
      margin-top: 4px;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-actions no-print">
    <div>
      <strong style="color:#0369a1;">External Team Review PDF Document:</strong> Click "Print / Save as PDF" below to generate or download an official PDF report.
    </div>
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="header-bar">
    <div>
      <div class="brand-subtitle">FLICK Community Safety & Executive Review</div>
      <div class="brand-title">Incident Reports Audit Summary</div>
    </div>
    <div class="meta-box">
      <div><strong>Export Date:</strong> ${exportDate}</div>
      <div><strong>Exported By:</strong> ${exportedByName}</div>
      <div><strong>Total Records:</strong> ${reports.length}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="kpi-card">
      <div class="kpi-num">${reports.length}</div>
      <div class="kpi-label">Total Reports</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num" style="color: #d97706">${openCount}</div>
      <div class="kpi-label">Open</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num" style="color: #0284c7">${reviewCount}</div>
      <div class="kpi-label">Under Review</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num" style="color: #16a34a">${resolvedCount}</div>
      <div class="kpi-label">Resolved</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num" style="color: #64748b">${dismissedCount}</div>
      <div class="kpi-label">Dismissed</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 12%;">ID / Date</th>
        <th style="width: 18%;">Author</th>
        <th style="width: 15%;">Category</th>
        <th style="width: 30%;">Subject & Description</th>
        <th style="width: 15%;">Evidence</th>
        <th style="width: 10%;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${reports
        .map((r) => {
          const badgeClass =
            r.status === 'Open'
              ? 'badge-open'
              : r.status === 'Under Review' || r.status === 'Reviewing'
              ? 'badge-review'
              : r.status === 'Resolved'
              ? 'badge-resolved'
              : 'badge-dismissed';

          return `
        <tr>
          <td>
            <strong>${r.id}</strong><br/>
            <span style="color:#64748b; font-size:9px;">${new Date(r.createdAt).toLocaleDateString()}</span>
          </td>
          <td>
            <strong>${r.authorName}</strong><br/>
            <span style="color:#64748b; font-size:9px;">${r.authorEmail}</span>
          </td>
          <td><strong>${r.reportType}</strong></td>
          <td>
            <strong>${r.subject}</strong>
            <div class="desc-box">${r.description}</div>
            ${
              r.resolutionNotes
                ? `<div style="color:#166534; font-size:9px; margin-top:4px;"><strong>Resolution:</strong> ${r.resolutionNotes}</div>`
                : ''
            }
          </td>
          <td>
            ${
              r.evidenceUrl
                ? `<a href="${r.evidenceUrl}" target="_blank" style="color:#0284c7; font-size:9px; word-break:break-all;">View Evidence Link</a>`
                : '<span style="color:#94a3b8;">None</span>'
            }
          </td>
          <td>
            <span class="badge ${badgeClass}">${r.status}</span>
          </td>
        </tr>
        `;
        })
        .join('')}
    </tbody>
  </table>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, Download, Search, XCircle } from 'lucide-react';

const statusStyle = {
  success: {
    icon: CheckCircle2,
    text: 'text-emerald-200',
    bg: 'bg-emerald-400/10',
    label: 'Success',
  },
  duplicate: {
    icon: AlertTriangle,
    text: 'text-amber-200',
    bg: 'bg-amber-400/10',
    label: 'Duplicate',
  },
  invalid: {
    icon: XCircle,
    text: 'text-red-200',
    bg: 'bg-red-400/10',
    label: 'Invalid',
  },
};

const PDF_SIGNATURE = 'MADE BY VAISIRI STUDENTS | ALL RIGHTS RESERVED';

export default function ScanLogs({ logs }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesFilter = filter === 'all' || log.status === filter;
      if (!matchesFilter) return false;
      if (!needle) return true;

      return [log.name, log.passId, log.detail, log.status, log.scannerId, log.scannerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filter, logs, query]);

  const counts = useMemo(
    () => logs.reduce(
      (total, log) => ({
        ...total,
        [log.status]: (total[log.status] || 0) + 1,
      }),
      { all: logs.length, success: 0, duplicate: 0, invalid: 0 }
    ),
    [logs]
  );

  const exportLogs = () => {
    if (filteredLogs.length === 0) return;

    const pdf = createScanLogsPdf({
      logs: filteredLogs,
      totals: counts,
      filter,
      query,
    });
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vivan-scan-logs-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-pink-200" />
          <span className="font-orbitron text-xs uppercase tracking-[0.25em] text-pink-100">Scan Logs</span>
        </div>
        <button
          type="button"
          onClick={exportLogs}
          disabled={filteredLogs.length === 0}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-orbitron text-[10px] uppercase tracking-widest text-white/50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
        <Search className="h-4 w-4 text-cyan-100/65" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or receipt ID"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
        />
      </label>

      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {[
          ['all', 'All'],
          ['success', 'Ok'],
          ['duplicate', 'Dup'],
          ['invalid', 'Bad'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg border px-2 py-2 font-orbitron text-[9px] uppercase tracking-widest transition ${
              filter === key
                ? 'border-cyan-300/35 bg-cyan-400/15 text-cyan-100'
                : 'border-white/10 bg-white/[0.035] text-white/38'
            }`}
          >
            {label} {counts[key] || 0}
          </button>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-center text-sm text-white/35">
          No scans yet
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-center text-sm text-white/35">
          No matching scans
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {filteredLogs.map((log) => {
              const meta = statusStyle[log.status] || statusStyle.invalid;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/25 p-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{log.name || log.passId}</p>
                      <span className="shrink-0 text-[10px] text-white/35">{log.time || formatLogTime(log.scanTime)}</span>
                    </div>
                    <p className="truncate text-xs text-white/45">{log.detail}</p>
                    {(log.scannerId || log.scannerName) && (
                      <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-cyan-100/45">
                        {log.scannerId || 'SCAN'} {log.scannerName ? `| ${log.scannerName}` : ''}
                      </p>
                    )}
                  </div>
                  <span className={`font-orbitron text-[10px] uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function formatLogTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function createScanLogsPdf({ logs, totals, filter, query }) {
  const pageWidth = 595;
  const pageHeight = 842;
  const rowsPerPage = 22;
  const pages = [];

  for (let index = 0; index < logs.length; index += rowsPerPage) {
    pages.push(logs.slice(index, index + rowsPerPage));
  }

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const pageStreams = pages.map((pageRows, pageIndex) => {
    const lines = [];
    const isLastPage = pageIndex === pages.length - 1;
    const pageNumber = pageIndex + 1;

    const text = (value, x, y, size = 10, font = 'F1') => {
      lines.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
    };
    const line = (x1, y1, x2, y2, width = 0.6) => {
      lines.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    };

    lines.push('0.02 0.02 0.04 rg');
    lines.push(`0 0 ${pageWidth} ${pageHeight} re f`);
    lines.push('1 1 1 rg');
    text('VIVAN VAIVIDHYA', 40, 790, 24, 'F2');
    text('QR EVENT CHECK-IN SCAN LOG REPORT', 40, 768, 11, 'F2');
    text(`Generated: ${generatedAt}`, 390, 790, 9, 'F1');
    text(`Rows: ${logs.length}`, 390, 774, 9, 'F1');

    lines.push('0.95 0.05 0.78 rg');
    line(40, 748, 555, 748, 1.4);
    lines.push('1 1 1 rg');
    text(`Filter: ${filter.toUpperCase()}   Search: ${query.trim() || 'NONE'}`, 40, 726, 9, 'F1');
    text(
      `All ${totals.all || 0} | Success ${totals.success || 0} | Duplicate ${totals.duplicate || 0} | Invalid ${totals.invalid || 0}`,
      40,
      710,
      9,
      'F1'
    );

    lines.push('0.1 0.85 0.95 rg');
    text('STATUS', 42, 680, 8, 'F2');
    text('NAME', 108, 680, 8, 'F2');
    text('PASS ID', 252, 680, 8, 'F2');
    text('TIME', 358, 680, 8, 'F2');
    text('DETAIL', 438, 680, 8, 'F2');
    lines.push('0.5 0.5 0.58 rg');
    line(40, 672, 555, 672);

    pageRows.forEach((log, rowIndex) => {
      const y = 650 - rowIndex * 23;
      const status = normalizePdfText(log.status || '').toUpperCase();
      const rowTime = formatPdfDateTime(log.scanTime) || log.time || '';

      if (rowIndex % 2 === 0) {
        lines.push('0.07 0.06 0.1 rg');
        lines.push(`40 ${y - 7} 515 18 re f`);
      }

      lines.push('1 1 1 rg');
      text(fitPdfText(status, 10), 42, y, 8, 'F2');
      text(fitPdfText(log.name || log.passId || 'Unknown', 24), 108, y, 8, 'F1');
      text(fitPdfText(log.passId || '-', 16), 252, y, 8, 'F1');
      text(fitPdfText(rowTime, 15), 358, y, 8, 'F1');
      text(fitPdfText(log.detail || '-', 21), 438, y, 8, 'F1');
    });

    lines.push('0.45 0.45 0.52 rg');
    line(40, 82, 555, 82);
    lines.push('1 1 1 rg');
    text(`Page ${pageNumber} of ${pages.length}`, 40, 62, 8, 'F1');

    if (isLastPage) {
      lines.push('0.98 0.78 0.28 rg');
      text(PDF_SIGNATURE, 350, 62, 11, 'F2');
    } else {
      lines.push('0.62 0.62 0.68 rg');
      text(PDF_SIGNATURE, 388, 62, 8, 'F1');
    }

    return lines.join('\n');
  });

  return buildPdfDocument(pageStreams);
}

function buildPdfDocument(pageStreams) {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];

  pageStreams.forEach((stream) => {
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

function fitPdfText(value, maxLength) {
  const text = normalizePdfText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizePdfText(value) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value) {
  return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatPdfDateTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const PDF_SIGNATURE = 'MADE BY VAISIRI STUDENTS | ALL RIGHTS RESERVED';

export function downloadPassListPdf(students) {
  const pdf = createPassListPdf(students);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vivan-total-pass-list-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createPassListPdf(students) {
  const pageWidth = 842;
  const pageHeight = 595;
  const rowsPerPage = 17;
  const pages = [];

  for (let index = 0; index < students.length; index += rowsPerPage) {
    pages.push(students.slice(index, index + rowsPerPage));
  }

  if (pages.length === 0) pages.push([]);

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
    text('VIVAN VAIVIDHYA', 38, 550, 24, 'F2');
    text('TOTAL PASS ISSUED DETAILS REPORT', 38, 529, 11, 'F2');
    text(`Generated: ${generatedAt}`, 640, 550, 9);
    text(`Total Passes: ${students.length}`, 640, 533, 9);

    lines.push('0.95 0.05 0.78 rg');
    line(38, 512, 804, 512, 1.4);

    lines.push('0.1 0.85 0.95 rg');
    text('NO', 42, 488, 8, 'F2');
    text('RECEIPT ID', 70, 488, 8, 'F2');
    text('NAME', 158, 488, 8, 'F2');
    text('USN', 298, 488, 8, 'F2');
    text('SEC', 376, 488, 8, 'F2');
    text('DEPARTMENT', 424, 488, 8, 'F2');
    text('PHONE', 548, 488, 8, 'F2');
    text('STATUS', 642, 488, 8, 'F2');
    text('ENTRY TIME', 712, 488, 8, 'F2');
    lines.push('0.5 0.5 0.58 rg');
    line(38, 479, 804, 479);

    if (students.length === 0) {
      lines.push('1 1 1 rg');
      text('No pass records found in Supabase.', 42, 448, 11, 'F1');
    }

    pageRows.forEach((student, rowIndex) => {
      const serial = pageIndex * rowsPerPage + rowIndex + 1;
      const y = 458 - rowIndex * 24;
      const entryTime = formatPdfDateTime(student.entry_time || student.updated_at);
      const status = student.checked_in || student.is_used ? 'USED' : 'NOT USED';

      if (rowIndex % 2 === 0) {
        lines.push('0.07 0.06 0.1 rg');
        lines.push(`38 ${y - 8} 766 19 re f`);
      }

      lines.push('1 1 1 rg');
      text(String(serial), 42, y, 8, 'F2');
      text(fitPdfText(student.receipt_id || student.pass_id || '-', 14), 70, y, 8);
      text(fitPdfText(student.name || 'Unknown', 23), 158, y, 8);
      text(fitPdfText(student.usn || '-', 12), 298, y, 8);
      text(fitPdfText(student.section || '-', 6), 376, y, 8);
      text(fitPdfText(student.department || student.college_name || '-', 18), 424, y, 8);
      text(fitPdfText(student.whatsapp_number || '-', 13), 548, y, 8);
      text(status, 642, y, 8, 'F2');
      text(fitPdfText(entryTime || '-', 18), 712, y, 8);
    });

    lines.push('0.45 0.45 0.52 rg');
    line(38, 56, 804, 56);
    lines.push('1 1 1 rg');
    text(`Page ${pageNumber} of ${pages.length}`, 38, 37, 8);

    if (isLastPage) {
      lines.push('0.98 0.78 0.28 rg');
      text(PDF_SIGNATURE, 560, 37, 10, 'F2');
    } else {
      lines.push('0.62 0.62 0.68 rg');
      text(PDF_SIGNATURE, 588, 37, 8);
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
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
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

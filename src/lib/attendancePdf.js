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
  const rowsPerPage = 16;
  const pages = [];

  for (let index = 0; index < students.length; index += rowsPerPage) {
    pages.push(students.slice(index, index + rowsPerPage));
  }

  if (pages.length === 0) pages.push([]);

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const usedCount = students.filter((student) => student.checked_in || student.is_used).length;
  const unusedCount = Math.max(0, students.length - usedCount);

  const pageStreams = pages.map((pageRows, pageIndex) => {
    const lines = [];
    const isLastPage = pageIndex === pages.length - 1;
    const pageNumber = pageIndex + 1;

    const text = (value, x, y, size = 10, font = 'F1', color = [1, 1, 1]) => {
      drawText(lines, value, x, y, size, font, color);
    };

    drawRect(lines, 0, 0, pageWidth, pageHeight, [0.015, 0.012, 0.032]);
    drawRect(lines, 0, 0, pageWidth, 595, [0.015, 0.012, 0.032]);
    drawRect(lines, 0, 540, pageWidth, 55, [0.07, 0.018, 0.11]);
    drawRect(lines, 0, 510, pageWidth, 32, [0.025, 0.025, 0.055]);
    drawLine(lines, 38, 508, 804, 508, [0.95, 0.05, 0.78], 1.4);
    drawLine(lines, 38, 504, 804, 504, [0.04, 0.9, 0.95], 0.5);

    drawCircle(lines, 66, 540, 27, [0.36, 0.04, 0.48], [0.98, 0.76, 0.25], 1.2);
    drawCircle(lines, 66, 540, 20, [0.055, 0.025, 0.09], [0.95, 0.05, 0.78], 0.7);
    text('VG', 51, 532, 18, 'F2', [1, 1, 1]);
    text('VIDYAVAHINI GROUP', 102, 557, 8, 'F2', [0.78, 0.68, 1]);
    text('VIVAN VAIVIDHYA', 102, 535, 24, 'F2', [1, 1, 1]);
    text('TOTAL PASS ISSUED DETAILS REPORT', 102, 518, 10, 'F2', [0.98, 0.78, 0.28]);

    drawRect(lines, 610, 523, 194, 40, [0.045, 0.04, 0.08]);
    drawLine(lines, 610, 523, 804, 523, [0.95, 0.05, 0.78], 0.7);
    text('Generated From Supabase', 624, 548, 8, 'F2', [0.1, 0.85, 0.95]);
    text(generatedAt, 624, 532, 9, 'F1', [0.9, 0.9, 0.95]);

    drawSummaryCard(lines, 38, 452, 176, 'TOTAL PASSES', students.length, [0.1, 0.85, 0.95]);
    drawSummaryCard(lines, 229, 452, 176, 'USED', usedCount, [0.22, 0.95, 0.58]);
    drawSummaryCard(lines, 420, 452, 176, 'NOT USED', unusedCount, [0.98, 0.78, 0.28]);
    drawSummaryCard(lines, 611, 452, 193, 'PAGE', `${pageNumber}/${pages.length}`, [0.95, 0.05, 0.78]);

    const headerY = 407;
    drawRect(lines, 38, headerY - 8, 766, 24, [0.08, 0.075, 0.13]);
    drawLine(lines, 38, headerY - 10, 804, headerY - 10, [0.1, 0.85, 0.95], 0.7);
    text('NO', 45, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('RECEIPT ID', 76, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('NAME', 166, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('USN', 306, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('SEC', 380, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('DEPARTMENT', 428, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('PHONE', 550, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('STATUS', 647, headerY, 8, 'F2', [0.1, 0.85, 0.95]);
    text('ENTRY TIME', 716, headerY, 8, 'F2', [0.1, 0.85, 0.95]);

    if (students.length === 0) {
      text('No pass records found in Supabase.', 42, 364, 11, 'F1', [0.9, 0.9, 0.94]);
    }

    pageRows.forEach((student, rowIndex) => {
      const serial = pageIndex * rowsPerPage + rowIndex + 1;
      const y = 380 - rowIndex * 21;
      const entryTime = formatPdfDateTime(student.entry_time || student.updated_at);
      const status = student.checked_in || student.is_used ? 'USED' : 'NOT USED';
      const statusColor = status === 'USED' ? [0.12, 0.65, 0.34] : [0.74, 0.48, 0.08];

      if (rowIndex % 2 === 0) {
        drawRect(lines, 38, y - 7, 766, 18, [0.045, 0.04, 0.075]);
      } else {
        drawRect(lines, 38, y - 7, 766, 18, [0.03, 0.028, 0.052]);
      }

      drawLine(lines, 38, y - 8, 804, y - 8, [0.14, 0.13, 0.2], 0.35);
      text(String(serial), 45, y, 8, 'F2', [0.96, 0.96, 1]);
      text(fitPdfText(student.receipt_id || student.pass_id || '-', 14), 76, y, 8, 'F1', [0.92, 0.92, 0.96]);
      text(fitPdfText(student.name || 'Unknown', 23), 166, y, 8, 'F2', [1, 1, 1]);
      text(fitPdfText(student.usn || '-', 12), 306, y, 8, 'F1', [0.82, 0.84, 0.92]);
      text(fitPdfText(student.section || '-', 6), 380, y, 8, 'F1', [0.82, 0.84, 0.92]);
      text(fitPdfText(student.department || student.college_name || '-', 18), 428, y, 8, 'F1', [0.82, 0.84, 0.92]);
      text(fitPdfText(student.whatsapp_number || '-', 13), 550, y, 8, 'F1', [0.82, 0.84, 0.92]);
      drawRect(lines, 640, y - 5, 58, 13, statusColor);
      text(status, status === 'USED' ? 657 : 647, y - 1, 7, 'F2', [1, 1, 1]);
      text(fitPdfText(entryTime || '-', 18), 716, y, 8, 'F1', [0.82, 0.84, 0.92]);
    });

    drawLine(lines, 38, 54, 804, 54, [0.28, 0.28, 0.34], 0.7);
    text(`Page ${pageNumber} of ${pages.length}`, 38, 35, 8, 'F1', [0.76, 0.76, 0.84]);
    text('Report generated for VIVAN VAIVIDHYA entry verification', 290, 35, 8, 'F1', [0.55, 0.56, 0.65]);

    if (isLastPage) {
      text(PDF_SIGNATURE, 552, 35, 10, 'F2', [0.98, 0.78, 0.28]);
    } else {
      text(PDF_SIGNATURE, 588, 35, 8, 'F1', [0.62, 0.62, 0.68]);
    }

    return lines.join('\n');
  });

  return buildPdfDocument(pageStreams);
}

function color(values) {
  return values.map((value) => Number(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')).join(' ');
}

function drawRect(lines, x, y, width, height, fill = [0, 0, 0]) {
  lines.push(`q ${color(fill)} rg ${x} ${y} ${width} ${height} re f Q`);
}

function drawLine(lines, x1, y1, x2, y2, stroke = [1, 1, 1], width = 0.6) {
  lines.push(`q ${color(stroke)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
}

function drawText(lines, value, x, y, size = 10, font = 'F1', fill = [1, 1, 1]) {
  lines.push(`BT /${font} ${size} Tf ${color(fill)} rg ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
}

function drawCircle(lines, cx, cy, radius, fill = [0, 0, 0], stroke = [1, 1, 1], width = 1) {
  const c = radius * 0.5522847498;
  lines.push(
    [
      'q',
      `${color(fill)} rg`,
      `${color(stroke)} RG`,
      `${width} w`,
      `${cx + radius} ${cy} m`,
      `${cx + radius} ${cy + c} ${cx + c} ${cy + radius} ${cx} ${cy + radius} c`,
      `${cx - c} ${cy + radius} ${cx - radius} ${cy + c} ${cx - radius} ${cy} c`,
      `${cx - radius} ${cy - c} ${cx - c} ${cy - radius} ${cx} ${cy - radius} c`,
      `${cx + c} ${cy - radius} ${cx + radius} ${cy - c} ${cx + radius} ${cy} c`,
      'h B Q',
    ].join(' ')
  );
}

function drawSummaryCard(lines, x, y, width, label, value, accent = [0.95, 0.05, 0.78]) {
  drawRect(lines, x, y, width, 38, [0.045, 0.04, 0.08]);
  drawLine(lines, x, y + 37.5, x + width, y + 37.5, accent, 1.1);
  drawLine(lines, x, y, x + width, y, [0.16, 0.15, 0.23], 0.45);
  drawText(lines, label, x + 12, y + 23, 7, 'F2', [0.66, 0.68, 0.78]);
  drawText(lines, String(value), x + 12, y + 8, 14, 'F2', [1, 1, 1]);
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

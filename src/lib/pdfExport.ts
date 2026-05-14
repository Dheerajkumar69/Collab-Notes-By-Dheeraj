/**
 * PDF export utilities. Uses jspdf + html2canvas (rasterized).
 * Both libraries are dynamically imported to keep them out of the main bundle.
 */

export interface NoteForPdf {
  title: string;
  content?: string | null; // HTML
  author_name?: string | null;
  group_name?: string;
  created_at?: string | null;
}

/**
 * Render HTML into a hidden offscreen container styled to match NotePage typography,
 * then rasterize it page-by-page into a PDF.
 */
async function renderHtmlToPdf(
  jsPDF: any,
  html2canvas: any,
  pdf: any,
  html: string,
  opts: { headerText?: string; firstPage?: boolean } = {},
): Promise<void> {
  // Build a hidden container with print-friendly styles.
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // ~A4 width @ 96dpi
  container.style.padding = '40px';
  container.style.background = '#ffffff';
  container.style.color = '#111111';
  container.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.innerHTML = `
    <style>
      .pdf-root h1 { font-size: 28px; margin: 16px 0 8px; color:#111; }
      .pdf-root h2 { font-size: 22px; margin: 14px 0 6px; color:#111; }
      .pdf-root h3 { font-size: 18px; margin: 12px 0 4px; color:#111; }
      .pdf-root p { margin: 8px 0; }
      .pdf-root ul, .pdf-root ol { padding-left: 24px; }
      .pdf-root blockquote { border-left:3px solid #ddd; margin:8px 0; padding:4px 12px; color:#555; }
      .pdf-root code { background:#f3f4f6; padding:1px 4px; border-radius:3px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .pdf-root pre { background:#f3f4f6; padding:10px; border-radius:6px; overflow:hidden; white-space:pre-wrap; word-break:break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .pdf-root mark { background:#fef08a; padding:1px 3px; }
      .pdf-root img { max-width:100%; height:auto; }
      .pdf-root table { border-collapse: collapse; width:100%; }
      .pdf-root th, .pdf-root td { border:1px solid #ddd; padding:6px; }
      .pdf-root a { color:#4f46e5; text-decoration: underline; }
    </style>
    <div class="pdf-root">${html}</div>
  `;
  document.body.appendChild(container);

  // Wait for images to load (best-effort, max 8s).
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.race([
    Promise.all(
      imgs.map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>(res => {
              img.addEventListener('load', () => res(), { once: true });
              img.addEventListener('error', () => res(), { once: true });
            }),
      ),
    ),
    new Promise<void>(res => setTimeout(res, 8000)),
  ]);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pageWidthPt = pdf.internal.pageSize.getWidth();
    const pageHeightPt = pdf.internal.pageSize.getHeight();
    const margin = 36; // 0.5 inch
    const usableWidth = pageWidthPt - margin * 2;
    const usableHeight = pageHeightPt - margin * 2;

    // Convert canvas pixels to PDF pts
    const pxToPt = usableWidth / canvas.width;
    const totalHeightPt = canvas.height * pxToPt;

    let heightLeft = totalHeightPt;
    let position = margin;
    let isFirst = true;

    while (heightLeft > 0) {
      if (!isFirst || !opts.firstPage) {
        if (!isFirst) pdf.addPage();
      }
      pdf.addImage(
        imgData,
        'JPEG',
        margin,
        position,
        usableWidth,
        totalHeightPt,
        undefined,
        'FAST',
      );
      heightLeft -= usableHeight;
      position = margin - (totalHeightPt - heightLeft);
      isFirst = false;
      if (heightLeft > 0) pdf.addPage();
    }
  } finally {
    container.remove();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNoteHeaderHtml(note: NoteForPdf): string {
  const meta: string[] = [];
  if (note.author_name) meta.push(`By ${escapeHtml(note.author_name)}`);
  if (note.group_name) meta.push(escapeHtml(note.group_name));
  if (note.created_at) {
    try {
      meta.push(new Date(note.created_at).toLocaleDateString());
    } catch { /* noop */ }
  }
  return `
    <h1>${escapeHtml(note.title)}</h1>
    ${meta.length ? `<p style="color:#6b7280;font-size:12px;margin-bottom:16px;">${meta.join(' • ')}</p>` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0 16px;" />
  `;
}

function addFooter(pdf: any, appName: string) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(140);
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    pdf.text(`${appName} • Exported ${new Date().toLocaleDateString()}`, 36, h - 18);
    pdf.text(`Page ${i} / ${total}`, w - 36, h - 18, { align: 'right' });
  }
}

/** Export a single note to PDF. */
export async function exportNoteToPdf(
  note: NoteForPdf,
  onProgress?: (msg: string) => void,
): Promise<void> {
  onProgress?.('Loading PDF engine…');
  const [{ default: jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = (html2canvasMod as any).default || html2canvasMod;

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  onProgress?.('Rendering note…');
  const html = buildNoteHeaderHtml(note) + (note.content || '<p><em>No content</em></p>');
  await renderHtmlToPdf(jsPDF, html2canvas, pdf, html, { firstPage: true });

  addFooter(pdf, 'CollabNotes');
  const safeName = (note.title || 'note').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80) || 'note';
  pdf.save(`${safeName}.pdf`);
}

/** Export many notes into one PDF with cover page. */
export async function exportNotesBundleToPdf(
  notes: NoteForPdf[],
  opts: { coverTitle?: string; onProgress?: (msg: string) => void } = {},
): Promise<void> {
  const { coverTitle = 'Notes Export', onProgress } = opts;
  onProgress?.('Loading PDF engine…');
  const [{ default: jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = (html2canvasMod as any).default || html2canvasMod;

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  // Cover page
  pdf.setFontSize(26);
  pdf.setTextColor(20);
  pdf.text(coverTitle, 60, 120);
  pdf.setFontSize(12);
  pdf.setTextColor(100);
  pdf.text(`${notes.length} notes`, 60, 150);
  pdf.text(new Date().toLocaleString(), 60, 170);

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    onProgress?.(`Rendering note ${i + 1}/${notes.length}…`);
    pdf.addPage();
    const html = buildNoteHeaderHtml(n) + (n.content || '<p><em>No content</em></p>');
    await renderHtmlToPdf(jsPDF, html2canvas, pdf, html);
  }

  addFooter(pdf, 'CollabNotes');
  pdf.save(`collabnotes-export-${new Date().toISOString().split('T')[0]}.pdf`);
}
import { createRequire } from 'node:module';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

const require = createRequire(import.meta.url);
const PdfPrinter = require('pdfmake');
const vfs: Record<string, string> = require('pdfmake/build/vfs_fonts.js');

const font = (f: string) => Buffer.from(vfs[f], 'base64');
const printer = new PdfPrinter({
  Roboto: {
    normal: font('Roboto-Regular.ttf'),
    bold: font('Roboto-Medium.ttf'),
    italics: font('Roboto-Italic.ttf'),
    bolditalics: font('Roboto-MediumItalic.ttf'),
  },
});

export const baseStyles: TDocumentDefinitions['styles'] = {
  title: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] },
  h2: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
  small: { fontSize: 8, color: '#555555' },
  label: { fontSize: 8, color: '#666666' },
  th: { bold: true, fontSize: 9, fillColor: '#f0f0f0' },
};

/**
 * Output is not byte-deterministic (pdfkit embeds random IDs), so integrity hashes are always
 * taken from the stored file that signers are shown — never from a re-render.
 */
export function renderPdf(doc: TDocumentDefinitions, createdAt = new Date()): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = printer.createPdfKitDocument({
      pageSize: 'A4',
      pageMargins: [50, 50, 50, 60],
      defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.25 },
      styles: baseStyles,
      info: { creationDate: createdAt, producer: 'vibepms', creator: 'vibepms', ...(doc.info ?? {}) },
      ...doc,
    });
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
}

/**
 * Minimal markdown → pdfmake: "# " title, "## " heading, "- " bullet, blank line = paragraph,
 * **bold** inline. Enough for contract templates that non-developers can edit.
 */
export function markdownToContent(md: string): Content[] {
  const out: Content[] = [];
  let bullets: Content[] = [];
  const flush = () => {
    if (bullets.length) out.push({ ul: bullets, margin: [0, 0, 0, 6] });
    bullets = [];
  };
  const inline = (s: string): Content => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return { text: parts.map((p) => (p.startsWith('**') ? { text: p.slice(2, -2), bold: true } : p)) } as Content;
  };
  for (const block of md.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    for (const line of lines) {
      if (line.startsWith('# ')) { flush(); out.push({ text: line.slice(2), style: 'title' }); }
      else if (line.startsWith('## ')) { flush(); out.push({ text: line.slice(3), style: 'h2' }); }
      else if (/^\s*- /.test(line)) bullets.push(inline(line.replace(/^\s*- /, '')));
      else { flush(); out.push({ ...(inline(line) as object), margin: [0, 0, 0, 4] } as Content); }
    }
    flush();
  }
  return out;
}

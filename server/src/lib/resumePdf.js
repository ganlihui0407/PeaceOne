import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { resumeTemplateByKey, resolveResumeTemplateKey } from './resumeTemplates.js';
import { buildResumeViewModel } from './resumeViewModel.js';

const FONTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
export const RESUME_FONT_REGULAR = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
export const RESUME_FONT_BOLD = path.join(FONTS_DIR, 'NotoSans-Bold.ttf');
export const RESUME_FONT_SC_REGULAR = path.join(FONTS_DIR, 'NotoSansSC-Regular.otf');
export const RESUME_FONT_SC_BOLD = path.join(FONTS_DIR, 'NotoSansSC-Bold.otf');
export const RESUME_FONT_JP_REGULAR = path.join(FONTS_DIR, 'NotoSansJP-Regular.otf');
export const RESUME_FONT_KR_REGULAR = path.join(FONTS_DIR, 'NotoSansKR-Regular.otf');

const FONT_REGULAR = 'ResumeSans';
const FONT_BOLD = 'ResumeSans-Bold';
const FONT_SC_REGULAR = 'ResumeSansSC';
const FONT_SC_BOLD = 'ResumeSansSC-Bold';
const FONT_JP_REGULAR = 'ResumeSansJP';
const FONT_KR_REGULAR = 'ResumeSansKR';
const MUTED = '#5f6b7a';
const INK = '#172033';
const ACCENT = '#0a66c2';

const STYLES = {
  classic: {
    margin: 54,
    nameSize: 22,
    contactSize: 9.5,
    sectionSize: 10.5,
    bodySize: 10,
    metaSize: 9,
    sectionGap: 14,
    itemGap: 8,
    headerFill: null,
  },
  modern: {
    margin: 48,
    nameSize: 22,
    contactSize: 9.5,
    sectionSize: 10.5,
    bodySize: 10,
    metaSize: 9,
    sectionGap: 13,
    itemGap: 8,
    headerFill: ACCENT,
  },
  compact: {
    margin: 42,
    nameSize: 16,
    contactSize: 8.5,
    sectionSize: 9,
    bodySize: 9,
    metaSize: 8,
    sectionGap: 8,
    itemGap: 5,
    headerFill: null,
  },
};

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function pageBottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > pageBottom(doc)) {
    doc.addPage();
  }
}

function isHangul(codePoint) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
    (codePoint >= 0x3130 && codePoint <= 0x318f) ||
    (codePoint >= 0xa960 && codePoint <= 0xa97f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    (codePoint >= 0xd7b0 && codePoint <= 0xd7ff)
  );
}

function isKana(codePoint) {
  return (
    (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
    (codePoint >= 0x31f0 && codePoint <= 0x31ff) ||
    (codePoint >= 0xff66 && codePoint <= 0xff9d)
  );
}

function isHan(codePoint) {
  return (
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x20000 && codePoint <= 0x2ceaf)
  );
}

function viewPlainText(view) {
  return [
    view.fullName,
    view.contactLine,
    view.summary,
    view.title,
    ...(view.education ?? []).flatMap((item) => [item.institution, item.detail, item.years, item.notes]),
    ...(view.experience ?? []).flatMap((item) => [
      item.jobTitle,
      item.organization,
      item.location,
      item.dates,
      item.description,
    ]),
    ...(view.skills ?? []).map((item) => item.display),
    ...(view.certifications ?? []).map((item) => item.display),
  ]
    .filter(Boolean)
    .join('\n');
}

function glyphChecker(doc, fontName) {
  doc.font(fontName);
  const font = doc._font?.font;
  if (!font || typeof font.hasGlyphForCodePoint !== 'function') {
    return () => false;
  }
  return (codePoint) => font.hasGlyphForCodePoint(codePoint);
}

function analyzeCjkScripts(text, hasLatinGlyph) {
  let sc = false;
  let jp = false;
  let kr = false;
  for (const char of String(text ?? '')) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0x7f || /\s/.test(char) || hasLatinGlyph(codePoint)) {
      continue;
    }
    if (isHangul(codePoint)) {
      kr = true;
    } else if (isKana(codePoint)) {
      jp = true;
    } else if (isHan(codePoint)) {
      sc = true;
    } else {
      sc = true;
      jp = true;
      kr = true;
    }
  }
  return { sc, jp, kr };
}

function createFontContext(doc, view) {
  doc.registerFont(FONT_REGULAR, RESUME_FONT_REGULAR);
  doc.registerFont(FONT_BOLD, RESUME_FONT_BOLD);
  const hasLatinGlyph = glyphChecker(doc, FONT_REGULAR);
  const scripts = analyzeCjkScripts(viewPlainText(view), hasLatinGlyph);
  if (scripts.sc) {
    doc.registerFont(FONT_SC_REGULAR, RESUME_FONT_SC_REGULAR);
    doc.registerFont(FONT_SC_BOLD, RESUME_FONT_SC_BOLD);
  }
  if (scripts.jp) {
    doc.registerFont(FONT_JP_REGULAR, RESUME_FONT_JP_REGULAR);
  }
  if (scripts.kr) {
    doc.registerFont(FONT_KR_REGULAR, RESUME_FONT_KR_REGULAR);
  }

  const regularStack = [FONT_REGULAR];
  const boldStack = [FONT_BOLD];
  if (scripts.sc) {
    regularStack.push(FONT_SC_REGULAR);
    boldStack.push(FONT_SC_BOLD);
  }
  if (scripts.jp) {
    regularStack.push(FONT_JP_REGULAR);
    boldStack.push(FONT_JP_REGULAR);
  }
  if (scripts.kr) {
    regularStack.push(FONT_KR_REGULAR);
    boldStack.push(FONT_KR_REGULAR);
  }

  const checkers = { [FONT_REGULAR]: hasLatinGlyph };
  for (const name of new Set([...regularStack, ...boldStack])) {
    if (!checkers[name]) {
      checkers[name] = glyphChecker(doc, name);
    }
  }

  return { regularStack, boldStack, checkers };
}

function resolveFont(fonts, char, bold) {
  const codePoint = char.codePointAt(0);
  if (char === '\n' || char === '\r' || /\s/.test(char)) {
    return bold ? FONT_BOLD : FONT_REGULAR;
  }
  const stack = bold ? fonts.boldStack : fonts.regularStack;
  for (const name of stack) {
    if (fonts.checkers[name]?.(codePoint)) {
      return name;
    }
  }
  return stack[0];
}

function layoutMixedLines(doc, fonts, text, bold, size, maxWidth) {
  doc.fontSize(size);
  const items = [...String(text ?? '')].map((char) => {
    const font = resolveFont(fonts, char, bold);
    doc.font(font).fontSize(size);
    return {
      char,
      font,
      width: char === '\n' ? 0 : doc.widthOfString(char),
      height: doc.currentLineHeight(),
    };
  });

  const lines = [];
  let lineItems = [];
  let lineWidth = 0;

  function pushLine(source) {
    const runs = [];
    let width = 0;
    let height = 0;
    for (const item of source) {
      if (item.char === '\n') {
        continue;
      }
      const last = runs[runs.length - 1];
      if (last && last.font === item.font) {
        last.text += item.char;
        last.width += item.width;
      } else {
        runs.push({ font: item.font, text: item.char, width: item.width });
      }
      width += item.width;
      height = Math.max(height, item.height);
    }
    doc.font(FONT_REGULAR).fontSize(size);
    lines.push({
      runs,
      width,
      height: height || doc.currentLineHeight(),
    });
  }

  function flushLine() {
    pushLine(lineItems);
    lineItems = [];
    lineWidth = 0;
  }

  for (const item of items) {
    if (item.char === '\n') {
      flushLine();
      continue;
    }
    if (lineWidth + item.width > maxWidth && lineItems.length > 0) {
      let breakAt = -1;
      for (let index = lineItems.length - 1; index >= 0; index -= 1) {
        if (/\s/.test(lineItems[index].char)) {
          breakAt = index;
          break;
        }
      }
      if (breakAt >= 0) {
        pushLine(lineItems.slice(0, breakAt + 1));
        lineItems = lineItems.slice(breakAt + 1);
        lineWidth = lineItems.reduce((sum, current) => sum + current.width, 0);
      } else {
        flushLine();
      }
    }
    if (lineItems.length === 0 && item.char === ' ') {
      continue;
    }
    lineItems.push(item);
    lineWidth += item.width;
  }
  if (lineItems.length > 0) {
    flushLine();
  }
  if (lines.length === 0) {
    doc.font(FONT_REGULAR).fontSize(size);
    return [{ runs: [], width: 0, height: doc.currentLineHeight() }];
  }
  return lines;
}

function writeMixed(doc, fonts, value, { bold = false, size, color = INK, gap = 2 } = {}) {
  const output = String(value ?? '').trim();
  if (!output) {
    return;
  }
  const lines = layoutMixedLines(doc, fonts, output, bold, size, contentWidth(doc));
  for (const line of lines) {
    ensureSpace(doc, line.height + 2);
    let cursorX = doc.page.margins.left;
    const y = doc.y;
    for (const run of line.runs) {
      doc.font(run.font).fontSize(size).fillColor(color);
      doc.text(run.text, cursorX, y, { lineBreak: false });
      cursorX += run.width;
    }
    doc.x = doc.page.margins.left;
    doc.y = y + line.height + 1.5;
  }
  doc.y += gap;
}

function headingWithMeta(doc, fonts, style, heading, meta) {
  const title = String(heading ?? '').trim();
  const metaText = String(meta ?? '').trim();
  if (!title && !metaText) {
    return;
  }
  const width = contentWidth(doc);
  const titleWidth = metaText ? width * 0.66 : width;
  const titleLines = layoutMixedLines(doc, fonts, title || ' ', true, style.bodySize, titleWidth);
  const metaLines = metaText
    ? layoutMixedLines(doc, fonts, metaText, false, style.metaSize, width - titleWidth)
    : [];
  const titleHeight = titleLines.reduce((sum, line) => sum + line.height + 1, 0);
  const metaHeight = metaLines.reduce((sum, line) => sum + line.height + 1, 0);
  const height = Math.max(titleHeight, metaHeight, 12);
  ensureSpace(doc, height + 4);
  const y = doc.y;
  let titleY = y;
  for (const line of titleLines) {
    let cursorX = doc.page.margins.left;
    for (const run of line.runs) {
      doc.font(run.font).fontSize(style.bodySize).fillColor(INK);
      doc.text(run.text, cursorX, titleY, { lineBreak: false });
      cursorX += run.width;
    }
    titleY += line.height + 1;
  }
  if (metaText) {
    const columnX = doc.page.margins.left + titleWidth;
    const columnWidth = width - titleWidth;
    let metaY = y;
    for (const line of metaLines) {
      let cursorX = columnX + Math.max(0, columnWidth - line.width);
      for (const run of line.runs) {
        doc.font(run.font).fontSize(style.metaSize).fillColor(MUTED);
        doc.text(run.text, cursorX, metaY, { lineBreak: false });
        cursorX += run.width;
      }
      metaY += line.height + 1;
    }
  }
  doc.x = doc.page.margins.left;
  doc.y = y + height + 2;
}

function rule(doc, color = INK) {
  const y = doc.y;
  doc.save();
  doc
    .strokeColor(color)
    .lineWidth(0.8)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
  doc.restore();
  doc.y = y + 6;
}

function sectionHeading(doc, fonts, style, title, { accent = false } = {}) {
  ensureSpace(doc, style.sectionSize + 18);
  doc.y += style.sectionGap / 2;
  writeMixed(doc, fonts, title.toUpperCase(), {
    bold: true,
    size: style.sectionSize,
    color: accent ? ACCENT : INK,
    gap: 2,
  });
  rule(doc, accent ? ACCENT : INK);
}

function drawPageNumbers(doc, fonts) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const label = `${index + 1} / ${range.count}`;
    const lines = layoutMixedLines(doc, fonts, label, false, 8, contentWidth(doc));
    const line = lines[0];
    const y = doc.page.height - 36;
    let cursorX = doc.page.margins.left + Math.max(0, (contentWidth(doc) - line.width) / 2);
    for (const run of line.runs) {
      doc.font(run.font).fontSize(8).fillColor(MUTED);
      doc.text(run.text, cursorX, y, { lineBreak: false });
      cursorX += run.width;
    }
  }
}

function renderHeader(doc, fonts, view, style, templateKey) {
  if (templateKey === 'modern') {
    const headerHeight = view.hasContact ? 86 : 64;
    doc.save();
    doc.rect(0, 0, doc.page.width, headerHeight).fill(style.headerFill);
    doc.restore();
    doc.y = 22;
    writeMixed(doc, fonts, view.fullName || 'Resume', {
      bold: true,
      size: style.nameSize,
      color: '#ffffff',
      gap: 2,
    });
    if (view.hasContact) {
      writeMixed(doc, fonts, view.contactLine, {
        size: style.contactSize,
        color: '#eaf3fc',
        gap: 0,
      });
    }
    doc.y = headerHeight + 18;
    return;
  }

  doc.y = doc.page.margins.top;
  writeMixed(doc, fonts, view.fullName || 'Resume', {
    bold: true,
    size: style.nameSize,
    color: INK,
    gap: 2,
  });
  if (templateKey === 'classic') {
    rule(doc, INK);
  }
  if (view.hasContact) {
    writeMixed(doc, fonts, view.contactLine, {
      size: style.contactSize,
      color: MUTED,
      gap: 4,
    });
  }
}

function renderSummary(doc, fonts, view, style, templateKey) {
  if (!view.hasSummary) {
    return;
  }
  sectionHeading(doc, fonts, style, 'Professional summary', { accent: templateKey === 'modern' });
  writeMixed(doc, fonts, view.summary, { size: style.bodySize, gap: 4 });
}

function renderEducation(doc, fonts, view, style, templateKey) {
  if (!view.hasEducation) {
    return;
  }
  sectionHeading(doc, fonts, style, 'Education', { accent: templateKey === 'modern' });
  for (const item of view.education) {
    headingWithMeta(doc, fonts, style, item.institution || item.detail, item.years);
    if (item.detail && item.institution) {
      writeMixed(doc, fonts, item.detail, { size: style.bodySize, color: MUTED, gap: 1 });
    }
    if (item.notes) {
      writeMixed(doc, fonts, item.notes, { size: style.bodySize, gap: 1 });
    }
    doc.y += style.itemGap;
  }
}

function renderExperience(doc, fonts, view, style, templateKey) {
  if (!view.hasExperience) {
    return;
  }
  sectionHeading(doc, fonts, style, 'Work experience', { accent: templateKey === 'modern' });
  for (const item of view.experience) {
    headingWithMeta(doc, fonts, style, item.jobTitle || item.organization, item.dates);
    const orgLine = [item.organization, item.location].filter(Boolean).join(' · ');
    if (orgLine && orgLine !== (item.jobTitle || item.organization)) {
      writeMixed(doc, fonts, orgLine, { size: style.bodySize, color: MUTED, gap: 1 });
    }
    if (item.description) {
      writeMixed(doc, fonts, item.description, { size: style.bodySize, gap: 1 });
    }
    doc.y += style.itemGap;
  }
}

function renderSkills(doc, fonts, view, style, templateKey) {
  if (!view.hasSkills) {
    return;
  }
  sectionHeading(doc, fonts, style, 'Skills', { accent: templateKey === 'modern' });
  writeMixed(doc, fonts, view.skills.map((item) => item.display).join(' · '), {
    size: style.bodySize,
    gap: 4,
  });
}

function renderCertifications(doc, fonts, view, style, templateKey) {
  if (!view.hasCertifications) {
    return;
  }
  sectionHeading(doc, fonts, style, 'Certifications', { accent: templateKey === 'modern' });
  for (const item of view.certifications) {
    writeMixed(doc, fonts, item.display, { size: style.bodySize, gap: 2 });
  }
}

export function generateResumePdf(source) {
  const view = buildResumeViewModel(source);
  const templateKey = resolveResumeTemplateKey(view.templateKey);
  const template = resumeTemplateByKey(templateKey);
  const style = STYLES[templateKey] ?? STYLES.classic;

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: {
        top: style.margin,
        bottom: 50,
        left: style.margin,
        right: style.margin,
      },
      info: {
        Title: view.fullName ? `${view.fullName} resume` : view.title || 'Resume',
        Author: 'PeaceOne',
        Subject: template.name,
        Keywords: templateKey,
        Creator: 'PeaceOne',
        Producer: 'PeaceOne',
      },
    });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const fonts = createFontContext(doc, view);
      renderHeader(doc, fonts, view, style, templateKey);
      renderSummary(doc, fonts, view, style, templateKey);
      renderEducation(doc, fonts, view, style, templateKey);
      renderExperience(doc, fonts, view, style, templateKey);
      renderSkills(doc, fonts, view, style, templateKey);
      renderCertifications(doc, fonts, view, style, templateKey);
      drawPageNumbers(doc, fonts);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

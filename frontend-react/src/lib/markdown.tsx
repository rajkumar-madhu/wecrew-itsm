/* eslint-disable react-refresh/only-export-components -- utility module: exports a renderer function alongside the <Markdown> component */
/**
 * Minimal, safe Markdown renderer.
 *
 * Parses a small Markdown subset straight into React elements — no
 * dangerouslySetInnerHTML anywhere, so raw HTML in the source is shown as
 * text. Supported: `#`–`###` headings, paragraphs, `- ` / `* ` and `1. `
 * lists, **bold**, *italic*, `inline code`, fenced ``` code blocks and
 * [text](url) links (http(s) and relative URLs only; anything else renders
 * as plain text).
 */
import type { CSSProperties, ReactNode } from 'react';

export type MarkdownTone = 'dark' | 'light';

interface Palette {
  text: string;
  heading: string;
  codeBg: string;
  codeText: string;
  codeBorder: string;
  link: string;
}

const PALETTES: Record<MarkdownTone, Palette> = {
  dark: {
    text: '#C5D8E8',
    heading: '#E8F1FA',
    codeBg: '#0F1B2D',
    codeText: '#E8F1FA',
    codeBorder: 'rgba(99,179,255,0.12)',
    link: '#818CF8',
  },
  light: {
    text: '#334155',
    heading: '#0F172A',
    codeBg: '#F1F5F9',
    codeText: '#0F172A',
    codeBorder: '#E2E8F0',
    link: '#4F46E5',
  },
};

/** True for http(s) URLs and relative URLs (no scheme, not protocol-relative). */
export function isSafeUrl(url: string): boolean {
  // Browsers ignore control chars / whitespace when parsing schemes.
  // eslint-disable-next-line no-control-regex
  const cleaned = url.replace(/[\u0000- \u007F]/g, '');
  if (!cleaned) return false;
  if (/^https?:\/\//i.test(cleaned)) return true;
  if (cleaned.startsWith('//') || cleaned.startsWith('\\')) return false;
  // Any other scheme (javascript:, data:, vbscript:, mailto:, …) is rejected.
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return false;
  return true;
}

// ── Inline ────────────────────────────────────────────────────────────────────
// Order matters: code spans first so their contents are never formatted.
const INLINE_RE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*/g;

function renderInline(text: string, p: Palette, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  const re = new RegExp(INLINE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      out.push(
        <code key={key} style={{
          background: p.codeBg, color: p.codeText, border: `1px solid ${p.codeBorder}`,
          borderRadius: 4, padding: '0 4px', fontSize: '0.9em',
        }} className="font-mono">{m[1]}</code>,
      );
    } else if (m[2] !== undefined && m[3] !== undefined) {
      const label = renderInline(m[2], p, key);
      if (isSafeUrl(m[3])) {
        out.push(
          <a key={key} href={m[3]} target="_blank" rel="noopener noreferrer"
            style={{ color: p.link, textDecoration: 'underline' }}>{label}</a>,
        );
      } else {
        out.push(<span key={key}>{label}</span>);
      }
    } else if (m[4] !== undefined) {
      out.push(<strong key={key} style={{ color: p.heading, fontWeight: 600 }}>{renderInline(m[4], p, key)}</strong>);
    } else if (m[5] !== undefined) {
      out.push(<em key={key}>{renderInline(m[5], p, key)}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── Blocks ────────────────────────────────────────────────────────────────────
type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'code'; text: string; lang: string }
  | { kind: 'list'; ordered: boolean; start: number; items: string[] };

const FENCE_RE = /^\s*```\s*([\w+-]*)\s*$/;
const HEADING_RE = /^(#{1,3})\s+(.*?)\s*#*\s*$/;
const UL_RE = /^\s*[-*]\s+(.*)$/;
const OL_RE = /^\s*(\d{1,9})\.\s+(.*)$/;

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'para', text: para.join(' ') });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = FENCE_RE.exec(line);
    if (fence) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
      blocks.push({ kind: 'code', text: body.join('\n'), lang: fence[1] });
      continue;
    }

    if (!line.trim()) { flushPara(); continue; }

    const h = HEADING_RE.exec(line);
    if (h) {
      flushPara();
      blocks.push({ kind: 'heading', level: h[1].length as 1 | 2 | 3, text: h[2] });
      continue;
    }

    const ul = UL_RE.exec(line);
    const ol = ul ? null : OL_RE.exec(line);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      const prev = blocks[blocks.length - 1];
      const item = ul ? ul[1] : ol![2];
      if (prev && prev.kind === 'list' && prev.ordered === ordered && lines[i - 1]?.trim()) {
        prev.items.push(item);
      } else {
        blocks.push({ kind: 'list', ordered, start: ol ? Number(ol[1]) : 1, items: [item] });
      }
      continue;
    }

    // Indented continuation of the previous list item
    const prev = blocks[blocks.length - 1];
    if (!para.length && prev && prev.kind === 'list' && /^\s{2,}\S/.test(line) && lines[i - 1]?.trim()) {
      prev.items[prev.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

/** Render a Markdown string to React nodes. */
export function renderMarkdown(src: string, tone: MarkdownTone = 'dark'): ReactNode {
  const p = PALETTES[tone];
  const blocks = parseBlocks(src || '');
  const headingSize: Record<1 | 2 | 3, string> = { 1: '1.35em', 2: '1.18em', 3: '1.05em' };

  return blocks.map((b, i) => {
    const key = `b${i}`;
    switch (b.kind) {
      case 'heading': {
        const style: CSSProperties = {
          color: p.heading, fontWeight: 700, fontSize: headingSize[b.level],
          margin: '1em 0 0.4em', lineHeight: 1.3,
        };
        const children = renderInline(b.text, p, key);
        if (b.level === 1) return <h1 key={key} style={style}>{children}</h1>;
        if (b.level === 2) return <h2 key={key} style={style}>{children}</h2>;
        return <h3 key={key} style={style}>{children}</h3>;
      }
      case 'code':
        return (
          <pre key={key} className="font-mono" data-lang={b.lang || undefined} style={{
            background: p.codeBg, color: p.codeText, border: `1px solid ${p.codeBorder}`,
            borderRadius: 8, padding: '10px 12px', margin: '0.75em 0', overflowX: 'auto',
            fontSize: '0.85em', lineHeight: 1.5, whiteSpace: 'pre',
          }}><code>{b.text}</code></pre>
        );
      case 'list': {
        const style: CSSProperties = { color: p.text, margin: '0.5em 0', paddingLeft: '1.4em', listStyleType: b.ordered ? 'decimal' : 'disc' };
        const items = b.items.map((it, j) => (
          <li key={`${key}-${j}`} style={{ margin: '0.2em 0' }}>{renderInline(it, p, `${key}-${j}`)}</li>
        ));
        return b.ordered
          ? <ol key={key} start={b.start} style={style}>{items}</ol>
          : <ul key={key} style={style}>{items}</ul>;
      }
      default:
        return (
          <p key={key} style={{ color: p.text, margin: '0.6em 0', lineHeight: 1.6 }}>
            {renderInline(b.text, p, key)}
          </p>
        );
    }
  });
}

export interface MarkdownProps {
  source: string;
  tone?: MarkdownTone;
  className?: string;
}

/** `<Markdown source="..." tone="dark" />` — wrapper around renderMarkdown. */
export function Markdown({ source, tone = 'dark', className }: MarkdownProps) {
  return <div className={className} style={{ wordBreak: 'break-word' }}>{renderMarkdown(source, tone)}</div>;
}

export default Markdown;

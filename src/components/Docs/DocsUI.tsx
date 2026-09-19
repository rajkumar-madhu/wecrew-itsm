import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Check, ChevronDown, Copy, Info } from 'lucide-react';
import type { Endpoint } from './endpoints';

/*
  Shared building blocks for /docs. Brand tokens only (bg-void / bg-obsidian /
  border-steel / text-ink|muted|dim and the *-dim accent pairs) so the page
  follows the light/dark theme like the rest of the public site.
*/

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 font-display text-[19px] font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 font-display text-[15px] font-semibold text-ink">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[14px] leading-relaxed text-muted">{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-steel bg-slate px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>
  );
}

/** Numbered how-to steps. */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-muted">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral-dim font-mono text-[11px] font-semibold text-coral">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-muted">
          <span className="mt-2.5 h-1 w-3 shrink-0 rounded bg-coral" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn'; title: string; children: ReactNode }) {
  const Icon = tone === 'warn' ? AlertTriangle : Info;
  return (
    <div
      className={clsx(
        'mt-5 rounded border p-4',
        tone === 'warn' ? 'border-amber bg-amber-dim' : 'border-signal bg-signal-dim'
      )}
    >
      <p className={clsx('flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide', tone === 'warn' ? 'text-amber' : 'text-signal')}>
        <Icon size={13} aria-hidden /> {title}
      </p>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/** Simple bordered table; horizontally scrollable inside itself, never the page. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded border border-steel">
      <table className="w-full min-w-[420px] text-[13px]">
        <thead>
          <tr className="bg-slate">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-dim">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-steel">
              {r.map((c, j) => (
                <td key={j} className={clsx('px-3 py-2 align-top', j === 0 ? 'font-medium text-ink' : 'text-muted')}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div className="mt-4 overflow-hidden rounded border border-steel">
      <div className="flex items-center justify-between border-b border-steel bg-slate px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-dim">{language}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1.5 font-mono text-[10px] text-dim transition-colors hover:text-ink">
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto bg-obsidian p-3 text-[12px] leading-relaxed">
        <code className="whitespace-pre font-mono text-ink">{code}</code>
      </pre>
    </div>
  );
}

const METHOD_TONE: Record<Endpoint['method'], string> = {
  GET: 'bg-emerald-dim text-emerald',
  POST: 'bg-signal-dim text-signal',
  PUT: 'bg-violet-dim text-violet',
  PATCH: 'bg-amber-dim text-amber',
  DELETE: 'bg-crimson-dim text-crimson',
};

const AUTH_TONE: Record<Endpoint['auth'], string> = {
  None: 'bg-emerald-dim text-emerald',
  Token: 'bg-cyan-dim text-cyan',
  Authenticated: 'bg-signal-dim text-signal',
  ADMIN: 'bg-crimson-dim text-crimson',
  'ADMIN, MANAGER': 'bg-amber-dim text-amber',
  'ADMIN, MANAGER, ENGINEER': 'bg-violet-dim text-violet',
  'Platform admin': 'bg-coral-dim text-coral',
};

export function MethodBadge({ method }: { method: Endpoint['method'] }) {
  return (
    <span className={clsx('inline-flex w-[58px] shrink-0 justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide', METHOD_TONE[method])}>
      {method}
    </span>
  );
}

export function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5 overflow-hidden rounded border border-steel bg-obsidian transition-shadow hover:shadow-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <MethodBadge method={ep.method} />
        <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-ink">{ep.path}</code>
        <span className={clsx('hidden rounded px-2 py-0.5 font-mono text-[10px] font-medium sm:inline-flex', AUTH_TONE[ep.auth])}>{ep.auth}</span>
        <ChevronDown size={14} className={clsx('shrink-0 text-dim transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-steel px-3 pb-3">
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{ep.description}</p>
          <p className="mt-2 sm:hidden">
            <span className={clsx('rounded px-2 py-0.5 font-mono text-[10px] font-medium', AUTH_TONE[ep.auth])}>{ep.auth}</span>
          </p>
          {ep.params && ep.params.length > 0 && (
            <Table
              head={['Name', 'In', 'Type', 'Description']}
              rows={ep.params.map((p) => [
                <span className="font-mono">{p.name}{p.required && <span className="ml-0.5 text-crimson">*</span>}</span>,
                p.in,
                <span className="font-mono">{p.type}</span>,
                p.description,
              ])}
            />
          )}
          {ep.exampleRequest && <CodeBlock code={ep.exampleRequest} language="bash" />}
          {ep.exampleResponse && <CodeBlock code={ep.exampleResponse} language="json" />}
        </div>
      )}
    </div>
  );
}

export function EndpointList({ endpoints }: { endpoints: Endpoint[] }) {
  return <div className="mt-4">{endpoints.map((ep) => <EndpointCard key={`${ep.method} ${ep.path}`} ep={ep} />)}</div>;
}

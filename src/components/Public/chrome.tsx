import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';

/*
  Layout primitives shared by the public marketing pages.

  These wrap the brand `cx-*` primitives from index.css rather than introducing
  a second styling vocabulary — `cx-eyebrow`, `cx-hero`, `cx-pill` and friends
  come straight from the Sovereign brand layer, so the public site and the
  product UI stay in step. Marketing pages need larger type than `cx-page-title`
  and `cx-section-title` provide, so headings use the `font-display` scale
  directly.
*/

/** Centred content column — the same measure on every public page. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>;
}

/** Vertical rhythm between page sections. */
export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={clsx('py-12 sm:py-16', className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** Eyebrow + display heading + deck, used above most sections. */
export function SectionIntro({
  eyebrow,
  title,
  deck,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  deck?: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={clsx('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && <p className="cx-eyebrow">{eyebrow}</p>}
      <h2 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {deck && <p className="mt-3 text-[14px] leading-relaxed text-muted">{deck}</p>}
    </div>
  );
}

/** Hairline card on the paper surface. */
export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  return (
    <Tag
      className={clsx(
        'rounded border border-steel bg-obsidian p-5 shadow-card transition-colors',
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** Coral-checked bullet list. */
export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={clsx('space-y-2', className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
          <Check size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-coral" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Uppercase mono micro-label. */
export function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-dim">{children}</span>
  );
}

/**
 * Disclosure row for FAQ-style content. Uses <details>/<summary> so the answer
 * is in the DOM for search and for anyone reading with assistive tech, and so
 * it still opens with JavaScript disabled.
 */
export function Disclosure({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group border-b border-steel py-4 last:border-b-0"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[14px] font-medium text-ink marker:content-['']">
        <span>{q}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={clsx('mt-0.5 shrink-0 text-dim transition-transform', open && 'rotate-180')}
        />
      </summary>
      <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-muted">{a}</p>
    </details>
  );
}

/** Two-column label/value list for procurement-style facts. */
export function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-steel py-3 last:border-b-0 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-4">
      <dt className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim sm:pt-0.5">
        {label}
      </dt>
      <dd className="text-[13px] leading-relaxed text-ink">{value}</dd>
    </div>
  );
}

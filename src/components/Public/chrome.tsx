import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

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

import { Children, Fragment, isValidElement } from 'react';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Codex-style page shell — quiet chrome, dense, hairline borders */

function flatten(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === Fragment) {
      out.push(...flatten((child.props as { children?: ReactNode }).children));
    } else if (child != null && child !== false) {
      out.push(child);
    }
  });
  return out;
}

function isPageChrome(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  if (child.type === 'style') return true;
  if (child.type === Toolbar || child.type === Segmented) return true;
  const cls = (child.props as { className?: unknown }).className;
  return typeof cls === 'string' && /\b(cx-hero|cx-crumb|cx-toolbar|cx-segmented)\b/.test(cls);
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  const items = flatten(children);
  const chrome: ReactNode[] = [];
  let i = 0;
  while (i < items.length && isPageChrome(items[i])) {
    chrome.push(items[i]);
    i += 1;
  }
  const body = items.slice(i);
  return (
    <div className={clsx('cx-page', className)}>
      {chrome}
      {body.length > 0 ? <div className="cx-page__body">{body}</div> : null}
    </div>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('cx-page-header', className)}>
      <div className="cx-page-header__left">
        {Icon && (
          <div className="cx-page-icon" aria-hidden>
            <Icon size={18} strokeWidth={1.75} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="cx-page-title">{title}</h1>
          {subtitle != null && <p className="cx-page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions != null && <div className="cx-page-actions">{actions}</div>}
    </div>
  );
}

export function KpiRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('cx-kpi-row', className)}>{children}</div>;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  loading,
  pulse,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: 'default' | 'danger' | 'warn' | 'ok' | 'info';
  loading?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className={clsx('cx-kpi', `cx-kpi--${tone}`)}>
      <div className="cx-kpi__top">
        <span className="cx-kpi__label">{label}</span>
        {Icon && (
          <span className="cx-kpi__icon">
            <Icon size={15} strokeWidth={1.75} />
            {pulse && Number(value) > 0 && <span className="cx-kpi__pulse" />}
          </span>
        )}
      </div>
      <div className="cx-kpi__value">{loading ? '—' : value}</div>
    </div>
  );
}

export function Panel({
  title,
  titleExtra,
  actions,
  children,
  noPad,
  className,
}: {
  title?: ReactNode;
  titleExtra?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  noPad?: boolean;
  className?: string;
}) {
  return (
    <section className={clsx('cx-panel', className)}>
      {(title != null || actions != null) && (
        <div className="cx-panel__head">
          <div className="cx-panel__title">
            {title}
            {titleExtra}
          </div>
          {actions != null && <div className="cx-panel__actions">{actions}</div>}
        </div>
      )}
      <div className={clsx(noPad ? '' : 'cx-panel__body')}>{children}</div>
    </section>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('cx-toolbar', className)}>{children}</div>;
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={clsx('cx-btn cx-btn--primary', className)}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('cx-btn cx-btn--ghost', active && 'cx-btn--active', className)}
    >
      {children}
    </button>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon?: LucideIcon }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="cx-segmented" role="tablist">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={clsx('cx-segmented__btn', value === opt.value && 'is-active')}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

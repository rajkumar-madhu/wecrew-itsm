import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { secondaryBtn } from './styles';

export function Card({ children, className = '', as: Tag = 'section', ...rest }: {
  children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string;
}) {
  return (
    <Tag className={`rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function BackLink({ to = '/portal', children = 'Back to Help Center' }: { to?: string; children?: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-[#4338CA] hover:text-[#3730A3] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {children}
    </Link>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-[#475569]">
      <Loader2 className="h-5 w-5 animate-spin text-[#4F46E5]" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-6 py-8 text-center">
      <AlertCircle className="h-6 w-6 text-[#DC2626]" aria-hidden="true" />
      <p className="text-sm text-[#991B1B]">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className={secondaryBtn}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]" aria-hidden="true">
        {icon}
      </div>
      <p className="font-display text-base font-semibold text-[#0F172A]">{title}</p>
      {children && <div className="max-w-sm text-sm text-[#475569]">{children}</div>}
    </div>
  );
}

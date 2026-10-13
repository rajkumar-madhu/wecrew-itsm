import type { Tone } from './portalUtils';

const TONES: Record<Tone, string> = {
  neutral: 'bg-[#F1F5F9] text-[#334155] border-[#E2E8F0]',
  muted: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
  info: 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]',
  progress: 'bg-[#E0F2FE] text-[#075985] border-[#BAE6FD]',
  warning: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
  success: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
  danger: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-[#64748B]', muted: 'bg-[#94A3B8]', info: 'bg-[#4F46E5]', progress: 'bg-[#0284C7]',
  warning: 'bg-[#D97706]', success: 'bg-[#16A34A]', danger: 'bg-[#DC2626]',
};

export default function StatusPill({ label, tone, className = '' }: { label: string; tone: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} />
      {label}
    </span>
  );
}

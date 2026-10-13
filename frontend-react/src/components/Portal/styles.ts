// Shared Tailwind class strings for the light, friendly portal look.

export const inputClass =
  'block w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#64748B] ' +
  'shadow-sm transition focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 ' +
  'aria-[invalid=true]:border-[#DC2626] aria-[invalid=true]:focus:ring-[#DC2626]/25 disabled:bg-[#F1F5F9]';

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm ' +
  'transition hover:bg-[#4338CA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#334155] ' +
  'transition hover:bg-[#F1F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const dangerBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white ' +
  'transition hover:bg-[#B91C1C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

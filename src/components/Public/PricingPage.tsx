import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { CheckList, Container, Section, SectionIntro } from './chrome';
import { COMPANY, PRICING, PRICING_FAQ } from './site';
import type { PricingTier } from './site';

/*
  /pricing — the three tiers and the questions buyers ask before a call.
  Tier copy and prices live in PRICING (site.ts) and must match the backend's
  seeded plans. Layout only here.
*/

function TierCta({ cta, highlight }: { cta: PricingTier['cta']; highlight?: boolean }) {
  const cls = clsx('cx-btn w-full justify-center', highlight ? 'cx-btn--primary' : 'cx-btn--ghost');
  if (cta.href) return <a href={cta.href} className={cls}>{cta.label}</a>;
  return (
    <Link to={cta.to ?? '/contact'} className={cls}>
      {cta.label}
      <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

export default function PricingPage() {
  return (
    <>
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-12">
          <p className="cx-eyebrow">Pricing</p>
          <h1 className="cx-hero__title max-w-3xl">Pay for the people who change things. Viewers are free.</h1>
          <p className="cx-hero__deck text-[15px]">
            Start with a free trial on your own incidents, move to Starter when one team runs on it, and talk to us
            when the estate spans many organizations.
          </p>
        </div>
      </Container>

      <Section>
        <div className="grid gap-5 md:grid-cols-3">
          {PRICING.map((tier) => (
            <article
              key={tier.key}
              className={clsx(
                'flex flex-col rounded border bg-obsidian p-6 shadow-card',
                tier.highlight ? 'border-coral' : 'border-steel'
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[20px] font-semibold text-ink">{tier.name}</h2>
                {tier.highlight && <span className="cx-pill">Most teams</span>}
              </div>
              <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink">{tier.price}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-dim">{tier.period}</p>
              <p className="mt-4 text-[13.5px] leading-relaxed text-muted">{tier.blurb}</p>
              <CheckList items={tier.features} className="mt-5 flex-1" />
              <div className="mt-6">
                <TierCta cta={tier.cta} highlight={tier.highlight} />
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-[13px] text-muted">
          Questions about a plan?{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-signal hover:underline">{COMPANY.email}</a>
          {COMPANY.phone && (
            <>
              {' '}or{' '}
              <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="text-signal hover:underline">
                {COMPANY.phone}
              </a>
            </>
          )}
        </p>
      </Section>

      <Section className="border-t border-steel bg-obsidian">
        <SectionIntro eyebrow="Before you buy" title="Common questions" />
        <dl className="mt-8 grid gap-6 md:grid-cols-2">
          {PRICING_FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-display text-[16px] font-semibold text-ink">{q}</dt>
              <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

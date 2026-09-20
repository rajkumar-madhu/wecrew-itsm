import { Link } from 'react-router-dom';
import {
  ArrowRight, Boxes, Brain, Building2, GitPullRequest, Radar, ShieldCheck, Siren, Timer, PhoneCall,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CheckList, Container, Disclosure, FactRow, Section, SectionIntro } from './chrome';
import {
  AUDIENCES,
  CAPABILITIES,
  COMPANY,
  DOC_LINKS,
  HOME_FAQ,
  ITIL_PRACTICES,
  MEASURES,
  PLATFORM_FACTS,
  PRACTICE_STATE_LABEL,
  HOME_EXAMPLE_INCIDENT,
  HOME_HERO,
  HOW_IT_WORKS,
  INTEGRATIONS,
  MODULES,
  PILOT_DAYS,
  PILOT_STEPS,
  PRICING,
  TENANCY_POINTS,
} from './site';
import type { CapabilityIcon } from './site';

/*
  Public home — B2B landing in the observability-vendor pattern: hero with two
  CTAs and a pricing hook, an integrations strip, a capability showcase with
  "learn more" links, how-it-works, tenancy + security, pricing band, final CTA.
  Route: "/" (anonymous visitors; signed-in users go to /dashboard).
  All copy lives in site.ts. Nothing here claims customers, badges or stats.
*/

const ICONS: Record<CapabilityIcon, LucideIcon> = {
  incidents: Siren,
  oncall: PhoneCall,
  change: GitPullRequest,
  cmdb: Boxes,
  observe: Radar,
  sla: Timer,
  ai: Brain,
  tenancy: Building2,
};

const starter = PRICING.find((t) => t.key === 'STARTER');
const trial = PRICING.find((t) => t.key === 'TRIAL');

/** Illustrative incident card on the dark hero — labelled "Example", no live data. */
function ExampleIncident() {
  const inc = HOME_EXAMPLE_INCIDENT;
  const fields = [
    { label: 'Customer', value: inc.customer },
    { label: 'Application', value: inc.application },
    { label: 'Host', value: `${inc.host} (${inc.ip})` },
    { label: 'Opened', value: inc.time },
  ];
  return (
    <div className="cx-hero__kpi !p-4 sm:!p-5" aria-label="Example incident">
      <div className="flex items-center justify-between gap-3">
        <span className="cx-hero__kpi-label">Example incident · {inc.number}</span>
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: 'var(--brand-coral)', color: '#fff' }}
        >
          {inc.severity}
        </span>
      </div>
      <p className="mt-3 font-display text-[1.05rem] font-semibold leading-snug" style={{ color: '#fff' }}>
        [{inc.severity}] {inc.customer} · {inc.application} · {inc.host} — {inc.issue}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="cx-hero__kpi-label">{f.label}</dt>
            <dd className="cx-hero__kpi-value !text-[0.9rem] truncate">{f.value}</dd>
          </div>
        ))}
      </dl>
      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {inc.steps.map((s) => (
          <li key={s.label} className="cx-hero__kpi !p-2.5">
            <div className="cx-hero__kpi-label">{s.label}</div>
            <div className="cx-hero__kpi-sub !mt-0.5">{s.value}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div className="min-w-0">
              <p className="cx-eyebrow">{HOME_HERO.eyebrow}</p>
              <h1 className="cx-hero__title max-w-xl text-[1.85rem] sm:text-[2.6rem]">{HOME_HERO.title}</h1>
              <p className="cx-hero__deck text-[15px] !max-w-[52ch]">{HOME_HERO.deck}</p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/pilot" className="cx-hero__btn">
                  Book a pilot
                  <ArrowRight size={14} strokeWidth={2} aria-hidden />
                </Link>
                <Link to="/pricing" className="cx-hero__btn cx-hero__btn--ghost">
                  See pricing
                </Link>
                <Link to="/docs" className="cx-hero__btn cx-hero__btn--ghost">
                  Explore the docs
                </Link>
              </div>

              {starter && trial && (
                <Link to="/pricing" className="mt-5 inline-flex items-center gap-1.5 cx-hero__kpi-sub hover:underline">
                  {starter.name} from {starter.price}/year · {trial.period.replace(' days', '-day')} free trial
                  <ArrowRight size={12} strokeWidth={2} aria-hidden />
                </Link>
              )}
            </div>

            <ExampleIncident />
          </div>
        </div>
      </Container>

      {/* Integrations strip */}
      <Section className="!py-8">
        <p className="text-center font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-dim">
          Works with the stack you already run
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {INTEGRATIONS.map((name) => (
            <li
              key={name}
              className="rounded border border-steel bg-obsidian px-3 py-1.5 text-[12.5px] font-medium text-muted"
            >
              {name}
            </li>
          ))}
        </ul>
      </Section>

      {/* Who it is for — enterprise buyers self-select before they read features */}
      <Section>
        <SectionIntro
          eyebrow="Who runs this"
          title="Three desks, one record"
          deck="The same incident record serves a provider running many customers, a platform team drowning in alerts, and the lead who has to report on both."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {AUDIENCES.map((aud) => (
            <Card key={aud.key} className="flex flex-col">
              <p className="cx-eyebrow">{aud.role}</p>
              <h3 className="mt-2 font-display text-[17px] font-semibold leading-snug text-ink">{aud.job}</h3>
              <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-muted">{aud.body}</p>
              <Link
                to={aud.to}
                className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-signal hover:underline"
              >
                {aud.linkLabel}
                <ArrowRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      {/* Capability showcase */}
      <Section className="border-y border-steel bg-obsidian">
        <SectionIntro
          eyebrow="Platform"
          title="One platform from the first alert to the post-incident review"
          deck="Everything an operations desk needs to run incidents for many customers, in one record per incident."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((cap) => {
            const Icon = ICONS[cap.key];
            return (
              <div key={cap.key} className="flex flex-col rounded border border-steel bg-void p-4">
                <Icon size={18} strokeWidth={1.75} className="text-coral" aria-hidden />
                <h3 className="mt-3 font-display text-[16px] font-semibold text-ink">{cap.title}</h3>
                <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-muted">{cap.body}</p>
                <Link
                  to={cap.to}
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-signal hover:underline"
                >
                  {cap.linkLabel}
                  <ArrowRight size={13} strokeWidth={2} aria-hidden />
                </Link>
              </div>
            );
          })}
        </div>
      </Section>

      {/* How it works */}
      <Section>
        <SectionIntro eyebrow="How it works" title="Alert in, accountable incident out" />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <Card as="li" key={step.title}>
              <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-dim">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 font-display text-[17px] font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </ol>
        <Link
          to="/docs#alert-webhooks"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-signal hover:underline"
        >
          Connect your first alert source
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </Section>

      {/* ITIL practice coverage — stated honestly, including what is NOT built */}
      <Section className="border-y border-steel bg-obsidian">
        <SectionIntro
          eyebrow="Practice coverage"
          title="Which ITIL 4 practices this actually implements"
          deck="Including the ones it does not. A coverage matrix you can check beats a claim you cannot — take this into your evaluation and hold us to it."
        />
        <div className="mt-8 overflow-hidden rounded border border-steel bg-void">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">ITIL 4 practice coverage</caption>
            <thead>
              <tr className="border-b border-steel">
                <th scope="col" className="px-4 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim">
                  Practice
                </th>
                <th scope="col" className="px-4 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim">
                  Status
                </th>
                <th scope="col" className="hidden px-4 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim sm:table-cell">
                  What that means
                </th>
              </tr>
            </thead>
            <tbody>
              {ITIL_PRACTICES.map((row) => (
                <tr key={row.practice} className="border-b border-steel last:border-b-0">
                  <th scope="row" className="px-4 py-3 align-top text-[13px] font-medium text-ink">
                    {row.practice}
                    <span className="mt-1 block text-[12px] font-normal leading-relaxed text-muted sm:hidden">
                      {row.note}
                    </span>
                  </th>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <span
                      className={
                        row.state === 'core'
                          ? 'cx-pill cx-pill--ok'
                          : row.state === 'partial'
                            ? 'cx-pill cx-pill--warn'
                            : 'cx-pill cx-pill--neutral'
                      }
                    >
                      {PRACTICE_STATE_LABEL[row.state]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 align-top text-[12.5px] leading-relaxed text-muted sm:table-cell">
                    {row.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* What you can measure — instrumentation, not claimed outcomes */}
      <Section>
        <SectionIntro
          eyebrow="Reporting"
          title="What you will be able to measure"
          deck="These are the measures the platform reports from your own records. We publish no benchmark numbers of our own — the only ones worth anything are the ones your estate produces."
        />
        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEASURES.map((m) => (
            <div key={m.metric} className="rounded border border-steel bg-obsidian p-4">
              <dt className="font-display text-[15px] font-semibold text-ink">{m.metric}</dt>
              <dd className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{m.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Multi-tenant + security */}
      <Section className="border-y border-steel bg-obsidian">
        <SectionIntro
          eyebrow="Built for MSPs and platform teams"
          title="Shared control plane. Private customer estates."
          deck="Run many customer organizations on one deployment without leaking tickets, assets or audit history between them."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TENANCY_POINTS.map((item) => (
            <div key={item.title} className="rounded border border-steel bg-void p-4">
              <h3 className="font-display text-[16px] font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <Link
          to="/security"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-signal hover:underline"
        >
          <ShieldCheck size={14} strokeWidth={1.75} aria-hidden />
          Read the security posture
        </Link>
      </Section>

      {/* Modules */}
      <Section>
        <SectionIntro
          eyebrow="Modules"
          title="Extend the core when the estate needs it"
          deck="The ITSM core stands alone. Modules add correlation, intelligence, scheduled-workload operations and governed automation."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((mod) => (
            <Card key={mod.key}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[16px] font-semibold text-ink">{mod.name}</h3>
                <span className={mod.status === 'available' ? 'cx-pill cx-pill--ok' : 'cx-pill cx-pill--neutral'}>
                  {mod.status === 'available' ? 'Available now' : 'Contact us'}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{mod.summary}</p>
            </Card>
          ))}
        </div>
        <Link
          to="/modules"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-signal hover:underline"
        >
          Compare the modules
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </Section>

      {/* Pricing band */}
      <Section className="border-y border-steel bg-obsidian">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <SectionIntro
            eyebrow="Pricing"
            title="Pay for the people who change things"
            deck="Viewers are free and unlimited. Start with a trial on your own incidents."
          />
          <ul className="grid gap-3 sm:grid-cols-3">
            {PRICING.map((tier) => (
              <li key={tier.key} className="rounded border border-steel bg-void p-4">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-dim">{tier.name}</p>
                <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{tier.price}</p>
                <p className="text-[12px] text-muted">{tier.period}</p>
              </li>
            ))}
          </ul>
        </div>
        <Link
          to="/pricing"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-signal hover:underline"
        >
          Compare plans
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </Section>

      {/* Procurement facts — the answers security review asks for first */}
      <Section className="border-y border-steel bg-obsidian">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <SectionIntro
            eyebrow="The details"
            title="Answers your security review will ask for"
            deck="Short, checkable facts about deployment, data and access — so an evaluation can start from something concrete instead of a discovery call."
          />
          <dl className="rounded border border-steel bg-void px-5 py-2">
            {PLATFORM_FACTS.map((f) => (
              <FactRow key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>
        </div>
        <Link
          to="/security"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-signal hover:underline"
        >
          <ShieldCheck size={14} strokeWidth={1.75} aria-hidden />
          Full security posture
        </Link>
      </Section>

      {/* Documentation — the product is documented, and the docs are public */}
      <Section>
        <SectionIntro
          eyebrow="Documentation"
          title="Read the docs before you talk to anyone"
          deck="The webhook format, the API, the tenancy header and the billing rules are all written down and public. Nothing behind this page needs a sales call to understand."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOC_LINKS.map((doc) => (
            <Link
              key={doc.to}
              to={doc.to}
              className="group flex flex-col rounded border border-steel bg-obsidian p-4 transition-colors hover:border-signal/50"
            >
              <h3 className="font-display text-[15px] font-semibold text-ink">{doc.title}</h3>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-muted">{doc.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-signal">
                Open
                <ArrowRight
                  size={13}
                  strokeWidth={2}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section className="border-y border-steel bg-obsidian">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <SectionIntro
            eyebrow="Questions"
            title="The six we are asked every time"
            deck="If yours is not here, ask it directly — you will get the same answer either way."
          />
          <div className="rounded border border-steel bg-void px-5 py-1">
            {HOME_FAQ.map((item) => (
              <Disclosure key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <Section>
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <SectionIntro
              eyebrow={`${PILOT_DAYS}-day pilot`}
              title={`Try ${COMPANY.product} on your own incidents`}
              deck="A pilot runs your real alert sources, not sample data. If it doesn't fit, you stop — nothing to unwind."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/pilot" className="cx-btn cx-btn--primary">
                Book a pilot
                <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </Link>
              <a href={`mailto:${COMPANY.email}?subject=WeCrew%20ITSM`} className="cx-btn cx-btn--ghost">
                Talk to sales
              </a>
            </div>
          </div>
          <Card>
            <p className="cx-eyebrow">How the pilot runs</p>
            <CheckList className="mt-3" items={PILOT_STEPS} />
          </Card>
        </div>
      </Section>
    </>
  );
}

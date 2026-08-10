import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, ClipboardCheck, ScrollText, ShieldCheck, Siren } from 'lucide-react';
import { Card, CheckList, Container, Section, SectionIntro } from './chrome';
import { COMPANY, MODULES, PILOT_DAYS } from './site';

/*
  Public home — states what WeCrew Ops is and pushes to the pilot.
  Route: "/" (unauthenticated visitors; signed-in users are sent to /dashboard).
*/

const PROOF_POINTS = [
  {
    icon: Siren,
    title: 'One situation, one incident',
    body: 'Alerts correlate before they page anyone, so on-call reads a problem rather than a stream of symptoms.',
  },
  {
    icon: Boxes,
    title: 'Assets that explain the blast radius',
    body: 'The CMDB knows which services depend on what, so impact is answered from the record instead of from memory.',
  },
  {
    icon: ClipboardCheck,
    title: 'Approval before change',
    body: 'Automation proposes; a named person approves. Nothing reaches production unattended.',
  },
  {
    icon: ScrollText,
    title: 'An audit trail you can hand over',
    body: 'Actor, timestamp and outcome on every state change — queryable in-product, exportable for review.',
  },
];

const PILOT_STEPS = [
  'Day 1 — deploy into a namespace on your cluster and connect one alert source.',
  'Days 2–7 — run real incidents through it alongside whatever you use today.',
  `Days 8–${PILOT_DAYS} — turn on correlation and AI incident intelligence, then review the audit trail together.`,
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-14">
          <p className="cx-eyebrow">{COMPANY.name}</p>
          <h1 className="cx-hero__title max-w-3xl text-3xl sm:text-[2.75rem]">
            IT operations you run yourself, on infrastructure you control.
          </h1>
          <p className="cx-hero__deck text-[15px]">
            {COMPANY.product} handles incidents, alerts, CMDB and SLA for teams that have to prove what happened
            and why. It deploys into your own Kubernetes cluster, keeps your operational data in your database,
            and never changes a production system without someone approving it first.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/pilot" className="cx-hero__btn">
              Start a {PILOT_DAYS}-day pilot
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </Link>
            <Link to="/itsm" className="cx-hero__btn cx-hero__btn--ghost">
              See what it does
            </Link>
          </div>

          <dl className="mt-9 grid max-w-2xl gap-4 sm:grid-cols-3">
            {[
              { label: 'Deployment', value: 'Self-hosted', sub: 'Your Kubernetes cluster' },
              { label: 'Your data', value: 'Stays yours', sub: 'Your database, your retention' },
              { label: 'Pilot', value: `${PILOT_DAYS} days`, sub: 'No commitment to continue' },
            ].map((item) => (
              <div key={item.label} className="cx-hero__kpi">
                <dt className="cx-hero__kpi-label">{item.label}</dt>
                <dd>
                  <div className="cx-hero__kpi-value text-[1.375rem]">{item.value}</div>
                  <div className="cx-hero__kpi-sub">{item.sub}</div>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>

      {/* What you get */}
      <Section>
        <SectionIntro
          eyebrow="Why teams move"
          title="Built for the part of the job that gets audited"
          deck="Most tooling is happy to tell you something is wrong. The harder problem is showing, afterwards, what was known, who decided, and what actually changed."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PROOF_POINTS.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <Icon size={18} strokeWidth={1.75} className="text-coral" aria-hidden />
              <h3 className="mt-3 font-display text-[17px] font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Modules teaser */}
      <Section className="border-y border-steel bg-obsidian">
        <SectionIntro
          eyebrow="Modules"
          title="Four modules, added when you need them"
          deck="The ITSM core stands on its own. Each module extends it without becoming a separate product to operate."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((mod) => (
            <div key={mod.key} className="rounded border border-steel bg-void p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[16px] font-semibold text-ink">{mod.name}</h3>
                <span className={mod.status === 'available' ? 'cx-pill cx-pill--ok' : 'cx-pill cx-pill--neutral'}>
                  {mod.status === 'available' ? 'Available now' : 'Contact us'}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{mod.summary}</p>
            </div>
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

      {/* Pilot CTA */}
      <Section>
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <SectionIntro
              eyebrow={`${PILOT_DAYS}-day pilot`}
              title="Run it against your own incidents before you decide"
              deck="A pilot is a working deployment on your cluster with your alert sources connected — not a sandbox with sample data. If it does not fit, you stop, and your data stays where it already was."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/pilot" className="cx-btn cx-btn--primary">
                Start the pilot
                <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </Link>
              <Link to="/security" className="cx-btn cx-btn--ghost">
                <ShieldCheck size={14} strokeWidth={1.75} aria-hidden />
                Read the security posture
              </Link>
            </div>
          </div>
          <Card>
            <p className="cx-eyebrow">How it runs</p>
            <CheckList className="mt-3" items={PILOT_STEPS} />
          </Card>
        </div>
      </Section>
    </>
  );
}

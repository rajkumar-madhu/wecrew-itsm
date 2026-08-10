import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Brain, Gauge, Siren, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CheckList, Container, Section, SectionIntro } from './chrome';
import { ITSM_CAPABILITIES, COMPANY, PILOT_DAYS } from './site';

/*
  /itsm — what the product does: incidents, alerts, CMDB, SLA, AI incident
  intelligence. Content lives in site.ts (ITSM_CAPABILITIES); this file only
  maps each capability key to an icon and lays it out.
*/

const ICONS: Record<string, LucideIcon> = {
  incidents: Siren,
  alerts: Wrench,
  cmdb: Boxes,
  sla: Gauge,
  ai: Brain,
};

export default function ItsmPage() {
  return (
    <>
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-12">
          <p className="cx-eyebrow">{COMPANY.product}</p>
          <h1 className="cx-hero__title max-w-3xl">
            Incidents, alerts, CMDB and SLA in one record — with the reasoning attached.
          </h1>
          <p className="cx-hero__deck text-[15px]">
            The pieces most teams run as four disconnected tools, kept in one place so an incident carries its
            alerts, the assets it touched, the SLA clock it is burning, and the evidence behind every suggestion
            made about it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/pilot" className="cx-hero__btn">
              Try it for {PILOT_DAYS} days
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </Link>
            <Link to="/modules" className="cx-hero__btn cx-hero__btn--ghost">
              See the modules
            </Link>
          </div>
        </div>
      </Container>

      <Section>
        <SectionIntro
          eyebrow="Capabilities"
          title="What the core covers"
          deck="Everything below ships with WeCrew ITSM itself — no module required."
        />

        <div className="mt-8 space-y-4">
          {ITSM_CAPABILITIES.map((cap) => {
            const Icon = ICONS[cap.key];
            return (
              <Card key={cap.key} as="article" className="md:grid md:grid-cols-[1.3fr_1fr] md:gap-8">
                <div>
                  <div className="flex items-center gap-2.5">
                    {Icon && <Icon size={18} strokeWidth={1.75} className="text-coral" aria-hidden />}
                    <h3 className="font-display text-[18px] font-semibold text-ink">{cap.name}</h3>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{cap.body}</p>
                </div>
                <CheckList className="mt-4 md:mt-0" items={cap.points} />
              </Card>
            );
          })}
        </div>
      </Section>

      <Section className="border-t border-steel bg-obsidian">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <SectionIntro
            eyebrow="AI, on a leash"
            title="Intelligence that argues its case"
            deck="Copilot summarises an incident, recalls similar ones and suggests a next step — always with the signals that led there. It writes to the incident record as evidence. It does not act on a production system, and it is not the thing that decides."
          />
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link to="/security" className="cx-btn cx-btn--ghost">
              How approvals work
            </Link>
            <Link to="/pilot" className="cx-btn cx-btn--primary">
              Start a pilot
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CheckList, Container, Section, SectionIntro } from './chrome';
import { MODULES, PILOT_DAYS } from './site';

/*
  /modules — AlertMind, AEGIS, JobWatch, AgentOS.

  Each card's status comes from MODULES in site.ts: 'available' renders an
  "Available now" pill and routes to the pilot; 'contact' renders "Contact us"
  and routes to /contact. Change availability there, not here.
*/

export default function ModulesPage() {
  return (
    <>
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-12">
          <p className="cx-eyebrow">Modules</p>
          <h1 className="cx-hero__title max-w-3xl">Extend the core without adding another product to run.</h1>
          <p className="cx-hero__deck text-[15px]">
            Modules install into the same deployment and write to the same records. Two are available today; two
            are rolling out with design partners — talk to us if either fits what you are trying to do.
          </p>
        </div>
      </Container>

      <Section>
        <SectionIntro
          eyebrow="Availability"
          title="Four modules"
          deck="Availability is per module, not per plan. Nothing here changes where your data lives."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {MODULES.map((mod) => {
            const available = mod.status === 'available';
            return (
              <Card key={mod.key} as="article" className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-[20px] font-semibold text-ink">{mod.name}</h2>
                  <span className={available ? 'cx-pill cx-pill--ok' : 'cx-pill cx-pill--neutral'}>
                    {available ? 'Available now' : 'Contact us'}
                  </span>
                </div>

                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{mod.summary}</p>

                <CheckList className="mt-4" items={mod.points} />

                <div className="mt-5 pt-4 border-t border-steel">
                  {available ? (
                    <Link to="/pilot" className="cx-btn cx-btn--primary">
                      Include in a pilot
                      <ArrowRight size={14} strokeWidth={2} aria-hidden />
                    </Link>
                  ) : (
                    <Link to="/contact" className="cx-btn cx-btn--ghost">
                      Talk to us about {mod.name}
                      <ArrowRight size={14} strokeWidth={2} aria-hidden />
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section className="border-t border-steel bg-obsidian">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <SectionIntro
            eyebrow="Not sure which"
            title="Start with the core and add from there"
            deck={`A ${PILOT_DAYS}-day pilot runs the ITSM core with the available modules switched on, so you can see what earns its place before anything is decided.`}
          />
          <Link to="/pilot" className="cx-btn cx-btn--primary">
            Start a pilot
            <ArrowRight size={14} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </Section>
    </>
  );
}

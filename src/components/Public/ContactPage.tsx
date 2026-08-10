import { Link } from 'react-router-dom';
import { Building2, Clock, Globe, Mail, Phone } from 'lucide-react';
import { Container, Section, SectionIntro } from './chrome';
import LeadForm from './LeadForm';
import { COMPANY, PILOT_DAYS } from './site';

/*
  /contact — company details plus a demo request.

  Optional COMPANY fields (phone, address, registration) render only when
  filled in, so an unset value shows nothing rather than an empty row or a
  placeholder. Fill them in src/components/Public/site.ts.
*/

export default function ContactPage() {
  const hasAddress = COMPANY.addressLines.length > 0;

  return (
    <>
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-12">
          <p className="cx-eyebrow">Contact</p>
          <h1 className="cx-hero__title max-w-3xl">Talk to the people who build it.</h1>
          <p className="cx-hero__deck text-[15px]">
            Demo requests, security questions, module availability, or whether this fits at all — all of it reaches
            the same small team.
          </p>
        </div>
      </Container>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <SectionIntro eyebrow="Company" title={COMPANY.name} deck={COMPANY.tagline} />

            <dl className="mt-6 space-y-4">
              <div className="flex gap-3">
                <Mail size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-coral" aria-hidden />
                <div>
                  <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-dim">Email</dt>
                  <dd className="mt-0.5 text-[13.5px] text-ink">
                    <a href={`mailto:${COMPANY.email}`} className="hover:text-signal hover:underline">
                      {COMPANY.email}
                    </a>
                  </dd>
                </div>
              </div>

              {COMPANY.phone && (
                <div className="flex gap-3">
                  <Phone size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-coral" aria-hidden />
                  <div>
                    <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-dim">Phone</dt>
                    <dd className="mt-0.5 text-[13.5px] text-ink">
                      <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="hover:text-signal hover:underline">
                        {COMPANY.phone}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Globe size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-coral" aria-hidden />
                <div>
                  <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-dim">Web</dt>
                  <dd className="mt-0.5 text-[13.5px] text-ink">
                    <a
                      href={COMPANY.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:text-signal hover:underline"
                    >
                      {COMPANY.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              </div>

              {hasAddress && (
                <div className="flex gap-3">
                  <Building2 size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-coral" aria-hidden />
                  <div>
                    <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-dim">
                      Registered office
                    </dt>
                    <dd className="mt-0.5 text-[13.5px] leading-relaxed text-ink">
                      {COMPANY.addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                      {COMPANY.registration && (
                        <span className="mt-1 block text-[12px] text-dim">{COMPANY.registration}</span>
                      )}
                    </dd>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Clock size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-coral" aria-hidden />
                <div>
                  <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-dim">Hours</dt>
                  <dd className="mt-0.5 text-[13.5px] text-ink">{COMPANY.hours}</dd>
                </div>
              </div>
            </dl>

            <p className="mt-8 rounded border border-steel bg-obsidian px-4 py-3 text-[13px] leading-relaxed text-muted">
              Ready to try it instead of talk about it?{' '}
              <Link to="/pilot" className="text-signal underline underline-offset-2">
                Start the {PILOT_DAYS}-day pilot
              </Link>
              .
            </p>
          </div>

          <div>
            <SectionIntro eyebrow="Request a demo" title="Tell us what you want to see" />
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
              A demo is a live walk-through against a real deployment — tell us the workflow you care about and we
              will show that, rather than a tour.
            </p>
            <div className="mt-6">
              <LeadForm
                interest="demo"
                submitLabel="Request a demo"
                messageLabel="What would you like us to show?"
              />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

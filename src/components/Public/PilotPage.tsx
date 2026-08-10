import { CalendarDays } from 'lucide-react';
import { CheckList, Container, Section, SectionIntro } from './chrome';
import LeadForm from './LeadForm';
import CalEmbed from './CalEmbed';
import { CAL_LINK, CAL_NAMESPACE, PILOT_DAYS } from './site';

/*
  /pilot — the conversion page. Two ways in, side by side: send details via the
  form, or book a call straight into the calendar. Neither is presented as the
  "real" path; whichever a visitor prefers reaches the same place.
*/

const WHAT_YOU_GET = [
  `A working ${PILOT_DAYS}-day deployment in a namespace on your own cluster`,
  'The ITSM core plus the modules that are available today',
  'One alert source connected on day one, more as you want them',
  'A shared channel with the people who built it',
  'A walk-through of the audit trail at the end, with your security reviewers if you want them there',
];

const WHAT_WE_NEED = [
  'A Kubernetes cluster you can deploy into, and someone who can apply manifests',
  'One monitoring or alerting source to connect',
  'An hour at the start and an hour at the end — the rest is you using it',
];

export default function PilotPage() {
  return (
    <>
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-12">
          <p className="cx-eyebrow">{PILOT_DAYS}-day pilot</p>
          <h1 className="cx-hero__title max-w-3xl">Run it on your own incidents for {PILOT_DAYS} days.</h1>
          <p className="cx-hero__deck text-[15px]">
            No sandbox, no sample data, no commitment to continue. It deploys onto your cluster, your data never
            leaves it, and if it does not earn its place you delete the namespace.
          </p>
        </div>
      </Container>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <SectionIntro eyebrow="Request a pilot" title="Send us your details" />
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
              We reply within one business day with the manifests and a short setup call.
            </p>
            <div className="mt-6">
              <LeadForm
                interest="pilot"
                submitLabel={`Request the ${PILOT_DAYS}-day pilot`}
                messageLabel="Anything we should know about your environment?"
              />
            </div>
          </div>

          <div>
            <SectionIntro eyebrow="Or book directly" title="Pick a time" />
            <p className="mt-3 flex items-center gap-2 text-[13.5px] leading-relaxed text-muted">
              <CalendarDays size={15} strokeWidth={1.75} className="shrink-0 text-coral" aria-hidden />
              A 30-minute call to scope the pilot and answer the obvious questions.
            </p>
            <CalEmbed className="mt-6" calLink={CAL_LINK} namespace={CAL_NAMESPACE} />
          </div>
        </div>
      </Section>

      <Section className="border-t border-steel bg-obsidian">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded border border-steel bg-void p-5">
            <p className="cx-eyebrow">What you get</p>
            <CheckList className="mt-4" items={WHAT_YOU_GET} />
          </div>
          <div className="rounded border border-steel bg-void p-5">
            <p className="cx-eyebrow">What we need from you</p>
            <CheckList className="mt-4" items={WHAT_WE_NEED} />
          </div>
        </div>
      </Section>
    </>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight, Database, FileCheck2, ScrollText, Search, Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container, Section, SectionIntro } from './chrome';
import { SECURITY_POSTURE } from './site';

/*
  /security — the five posture commitments. Copy lives in SECURITY_POSTURE
  (site.ts); this file maps each key to an icon and lays them out as a numbered
  list, because the order is the argument: where it runs, whose data it is,
  what it shows before acting, who approves, and what is recorded.
*/

const ICONS: Record<string, LucideIcon> = {
  'self-hosted': Server,
  data: Database,
  evidence: Search,
  approval: FileCheck2,
  audit: ScrollText,
};

const NOT_CLAIMS = [
  'No copy of your incident, asset or log data is held by us.',
  'No outbound connection is required for the product to function.',
  'No automated action reaches a production system without a recorded human approval.',
];

export default function SecurityPage() {
  return (
    <>
      <Container className="pt-8">
        <div className="cx-hero px-6 py-10 sm:px-10 sm:py-12">
          <p className="cx-eyebrow">Security posture</p>
          <h1 className="cx-hero__title max-w-3xl">Your cluster, your data, and a record of every decision.</h1>
          <p className="cx-hero__deck text-[15px]">
            The design constraint is simple: an operations tool should not become another place your data leaks
            from, and it should never be the reason nobody can explain what changed.
          </p>
        </div>
      </Container>

      <Section>
        <ol className="space-y-4">
          {SECURITY_POSTURE.map((item, i) => {
            const Icon = ICONS[item.key];
            return (
              <li
                key={item.key}
                className="rounded border border-steel bg-obsidian p-5 shadow-card sm:flex sm:gap-5"
              >
                <div className="flex items-center gap-3 sm:block sm:shrink-0">
                  <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-dim">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {Icon && (
                    <span className="grid h-9 w-9 place-items-center rounded border border-steel bg-void text-coral sm:mt-2">
                      <Icon size={17} strokeWidth={1.75} aria-hidden />
                    </span>
                  )}
                </div>
                <div className="mt-3 sm:mt-0">
                  <h2 className="font-display text-[18px] font-semibold text-ink">{item.title}</h2>
                  <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-muted">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section className="border-t border-steel bg-obsidian">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <SectionIntro eyebrow="Stated plainly" title="What we do not do" />
            <ul className="mt-5 space-y-3">
              {NOT_CLAIMS.map((claim) => (
                <li key={claim} className="flex gap-3 text-[13.5px] leading-relaxed text-muted">
                  <span className="mt-2 h-1 w-4 shrink-0 rounded bg-coral" aria-hidden />
                  <span>{claim}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-steel bg-void p-5">
            <p className="cx-eyebrow">Reviewing us</p>
            <h2 className="mt-2 font-display text-[18px] font-semibold text-ink">
              Bring your security team to the pilot
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              A pilot deploys into a namespace you control, so the manifests, the network policy and the audit
              output are all reviewable in your own environment before anything is decided. Send us the questions
              your review process asks and we will answer them against the running deployment.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/pilot" className="cx-btn cx-btn--primary">
                Start a pilot
                <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </Link>
              <Link to="/contact" className="cx-btn cx-btn--ghost">
                Send security questions
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

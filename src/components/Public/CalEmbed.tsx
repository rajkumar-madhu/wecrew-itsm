import { useEffect, useRef } from 'react';
import { useThemeStore } from '../../stores/themeStore';

/*
  Cal.com inline booking embed.

  This is the one place the public site loads a third-party script
  (https://app.cal.com/embed/embed.js). It is mounted only on /pilot, so no
  other public page makes an outbound request. If that trade-off is unwanted on
  a site that markets customer-controlled data, drop this component and use the
  plain `fallbackHref` link below on its own.

  `ensureCal` reproduces Cal's official loader stub: calls made before
  embed.js finishes downloading are queued on `Cal.q` / `Cal.ns.<ns>.q` and
  replayed by the script once it loads, so no ready-event handling is needed.
*/

const EMBED_SRC = 'https://app.cal.com/embed/embed.js';
const CAL_ORIGIN = 'https://cal.com';

type CalFn = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  ns?: Record<string, CalFn>;
  q?: unknown[][];
};

declare global {
  interface Window {
    Cal?: CalFn;
  }
}

function ensureCal(): CalFn {
  const existing = window.Cal;
  if (existing) return existing;

  const push = (target: CalFn, args: unknown[]) => {
    target.q = target.q || [];
    target.q.push(args);
  };

  const cal = ((...args: unknown[]) => {
    const self = window.Cal as CalFn;
    if (!self.loaded) {
      self.ns = {};
      self.q = self.q || [];
      const script = document.createElement('script');
      script.src = EMBED_SRC;
      script.async = true;
      document.head.appendChild(script);
      self.loaded = true;
    }
    if (args[0] === 'init') {
      const namespace = args[1];
      if (typeof namespace === 'string') {
        const api = ((...inner: unknown[]) => push(api, inner)) as CalFn;
        api.q = api.q || [];
        self.ns = self.ns || {};
        self.ns[namespace] = self.ns[namespace] || api;
        push(self.ns[namespace], args);
        push(self, ['initNamespace', namespace]);
        return;
      }
    }
    push(self, args);
  }) as CalFn;

  cal.q = [];
  window.Cal = cal;
  return cal;
}

export default function CalEmbed({
  calLink,
  namespace,
  fallbackHref,
  className,
}: {
  calLink: string;
  namespace: string;
  fallbackHref?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const href = fallbackHref || `${CAL_ORIGIN}/${calLink}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cal = ensureCal();
    cal('init', namespace, { origin: CAL_ORIGIN });
    // `elementOrSelector` accepts a live element — passed directly rather than
    // via an id so React's generated ids (which contain ':') never reach
    // querySelector.
    window.Cal?.ns?.[namespace]?.('inline', {
      elementOrSelector: container,
      calLink,
      config: { layout: 'month_view', theme },
    });

    return () => {
      // Strict Mode runs effects twice in dev, and a theme change re-runs this
      // one. Without clearing, Cal appends a second iframe each time.
      container.replaceChildren();
    };
  }, [calLink, namespace, theme]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="min-h-[520px] w-full overflow-y-auto rounded border border-steel bg-obsidian"
        // The embed fills this element; the text is what a visitor sees if the
        // script is blocked or fails.
      />
      <p className="mt-3 text-[12px] text-dim">
        Calendar not loading?{' '}
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-signal underline underline-offset-2"
        >
          Open the booking page directly
        </a>
        .
      </p>
    </div>
  );
}

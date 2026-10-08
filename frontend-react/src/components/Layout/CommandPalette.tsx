// ═══════════════════════════════════════════════════════════
// Argus ITSM — Command palette (Ctrl/Cmd+K)
// One place to jump to a page, start a common action, or open a record.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, AlertTriangle, GitBranch, Bug, Server, Siren, Plus, CornerDownLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useGlobalSearch } from '../../hooks/useSearch';
import { NAV_HUBS, ADMIN_HUB, visibleItems } from './navigation';

interface Command {
  id: string;
  group: 'Actions' | 'Pages' | 'Records';
  label: string;
  hint?: string;
  meta?: string;
  icon: LucideIcon;
  to: string;
  keywords?: string;
}

interface SearchHit {
  id: string; number?: string; title?: string; shortDescription?: string; name?: string;
  subject?: string; description?: string; priority?: string; severity?: string; state?: string; status?: string;
}

const RECORD_GROUPS: { key: string; label: string; icon: LucideIcon; route: string }[] = [
  { key: 'incidents', label: 'Incident', icon: AlertTriangle, route: '/incidents' },
  { key: 'changes', label: 'Change', icon: GitBranch, route: '/changes' },
  { key: 'problems', label: 'Problem', icon: Bug, route: '/problems' },
  { key: 'assets', label: 'Asset', icon: Server, route: '/assets' },
  { key: 'alerts', label: 'Alert', icon: Siren, route: '/alerts' },
];

const ACTIONS: Command[] = [
  { id: 'new-incident', group: 'Actions', label: 'Report an incident', icon: Plus, to: '/incidents/create', keywords: 'new create inc raise' },
  { id: 'new-change', group: 'Actions', label: 'Request a change', icon: Plus, to: '/changes/create', keywords: 'new create chg rfc' },
  { id: 'new-problem', group: 'Actions', label: 'Open a problem', icon: Plus, to: '/problems/create', keywords: 'new create prb rca' },
  { id: 'new-asset', group: 'Actions', label: 'Add an asset', icon: Plus, to: '/assets/create', keywords: 'new create ci cmdb server' },
];

function matches(cmd: Command, q: string): boolean {
  if (!q) return true;
  const hay = `${cmd.label} ${cmd.hint ?? ''} ${cmd.keywords ?? ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function hitTitle(h: SearchHit): string {
  return h.shortDescription || h.title || h.subject || h.name || h.description || 'Untitled';
}

export default function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);

  // Global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUIStore.getState().commandPaletteOpen);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // Mounting on open gives every session a fresh query and selection
  return open ? <PaletteDialog onClose={() => setOpen(false)} /> : null;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const role = useAuthStore((s) => s.user?.role) || 'VIEWER';
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Focus the input; give focus back to whatever opened the palette on close
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const { data: searchData, isFetching } = useGlobalSearch(query.trim());

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [...NAV_HUBS, ADMIN_HUB].flatMap((hub) =>
      visibleItems(hub, role).map((item) => ({
        id: `page:${item.to}`, group: 'Pages' as const, label: item.label, hint: hub.label,
        icon: item.icon, to: item.to, keywords: `${hub.label} ${item.keywords ?? ''}`,
      })),
    );
    const q = query.trim();
    const actions = ACTIONS.filter((c) => matches(c, q));
    const pageHits = pages.filter((c) => matches(c, q)).slice(0, q ? 8 : 6);

    const records: Command[] = [];
    const results = q.length >= 2 ? searchData?.data?.results : null;
    if (results) {
      for (const g of RECORD_GROUPS) {
        const hits: SearchHit[] = results[g.key] || [];
        for (const h of hits.slice(0, 5)) {
          records.push({
            id: `rec:${g.key}:${h.id}`, group: 'Records', label: hitTitle(h),
            hint: h.number || g.label, meta: h.priority || h.severity || h.state || h.status,
            icon: g.icon, to: `${g.route}/${h.id}`,
          });
        }
      }
    }
    // With a query, records lead; without one, actions lead
    return q ? [...records, ...actions, ...pageHits] : [...actions, ...pageHits];
  }, [query, role, searchData]);

  // Keep the highlighted option in view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function run(cmd: Command | undefined) {
    if (!cmd) return;
    onClose();
    navigate(cmd.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, commands.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(commands[activeIdx]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Tab') { e.preventDefault(); } // keep focus inside the dialog
  }

  const q = query.trim();
  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: 'rgba(6,10,20,0.72)', backdropFilter: 'blur(6px)' }}
      onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search and jump to"
        className="w-full max-w-xl overflow-hidden rounded-2xl"
        style={{ background: '#0C1828', border: '1px solid rgba(99,179,255,0.18)', boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(99,179,255,0.10)' }}>
          <Search className="w-5 h-5 shrink-0" style={{ color: '#818CF8' }} aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={commands[activeIdx] ? `cmdk-opt-${activeIdx}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search records, pages and actions…"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[#7590A9]"
            style={{ color: '#E2EEF9' }}
          />
          {isFetching && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818CF8' }} aria-label="Searching" />}
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ color: '#9DB3C8', border: '1px solid rgba(99,179,255,0.18)' }}>Esc</kbd>
        </div>

        <ul id="cmdk-list" role="listbox" ref={listRef} aria-label="Results" className="max-h-[56vh] overflow-y-auto py-2">
          {commands.length === 0 && (
            <li className="px-4 py-8 text-center text-[13px]" style={{ color: '#9DB3C8' }}>
              {q.length >= 2 && isFetching ? 'Searching…' : `Nothing matches "${q}". Try an incident number like INC0001234.`}
            </li>
          )}
          {commands.map((cmd, i) => {
            const header = cmd.group !== lastGroup ? cmd.group : null;
            lastGroup = cmd.group;
            const active = i === activeIdx;
            return (
              <li key={cmd.id} role="presentation">
                {header && (
                  <div role="presentation" className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#7F97AD' }}>
                    {header}
                  </div>
                )}
                <div
                  id={`cmdk-opt-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => setActiveIdx(i)}
                  onClick={() => run(cmd)}
                  className="mx-2 flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
                  style={active ? { background: 'rgba(79,70,229,0.22)' } : undefined}
                >
                  <cmd.icon className="w-4 h-4 shrink-0" style={{ color: active ? '#A5B4FC' : '#7590A9' }} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-[13px]" style={{ color: '#E2EEF9' }}>{cmd.label}</span>
                  {cmd.meta && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#C7D2FE', background: 'rgba(129,140,248,0.14)' }}>{cmd.meta}</span>
                  )}
                  {cmd.hint && <span className="text-[11px] font-mono shrink-0" style={{ color: '#9DB3C8' }}>{cmd.hint}</span>}
                  {active && <CornerDownLeft className="w-3.5 h-3.5 shrink-0" style={{ color: '#9DB3C8' }} aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 px-4 py-2 text-[11px]" style={{ color: '#9DB3C8', borderTop: '1px solid rgba(99,179,255,0.10)' }}>
          <span><kbd className="font-mono">↑↓</kbd> move</span>
          <span><kbd className="font-mono">Enter</kbd> open</span>
          <span className="ml-auto">{q.length === 1 ? 'Type one more character to search records' : 'Ctrl K toggles this anywhere'}</span>
        </div>
      </div>
    </div>
  );
}

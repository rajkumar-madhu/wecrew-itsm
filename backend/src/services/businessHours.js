// ═══════════════════════════════════════════════════════════
// Argus ITSM — Business hours
// Adds "working minutes" to a start time using an org's weekly schedule,
// timezone and holidays, so SLA clocks only run while the desk is staffed.
// ═══════════════════════════════════════════════════════════

const DAY_MS = 24 * 60 * 60 * 1000;

// Default used when a policy is business-hours-only but the org has no calendar
const DEFAULT_SCHEDULE = { 1: ['09:00', '18:00'], 2: ['09:00', '18:00'], 3: ['09:00', '18:00'], 4: ['09:00', '18:00'], 5: ['09:00', '18:00'] };

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 24 * 60 ? v : null;
}

// Wall-clock parts of an instant in a timezone
function partsIn(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    weekday,
    minuteOfDay: Number(p.hour) * 60 + Number(p.minute),
    second: Number(p.second),
  };
}

// UTC offset (ms) of a timezone at an instant
function offsetAt(date, timeZone) {
  const p = partsIn(date, timeZone);
  const [y, mo, d] = p.ymd.split('-').map(Number);
  const asUTC = Date.UTC(y, mo - 1, d, Math.floor(p.minuteOfDay / 60), p.minuteOfDay % 60, p.second);
  return asUTC - (date.getTime() - date.getUTCMilliseconds());
}

// The instant at a wall-clock minute on a calendar day in a timezone
function instantAt(ymd, minuteOfDay, timeZone) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  const first = guess - offsetAt(new Date(guess), timeZone);
  return new Date(guess - offsetAt(new Date(first), timeZone));
}

function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return 'schedule must be an object keyed by weekday 1-7';
  for (const [day, span] of Object.entries(schedule)) {
    if (!/^[1-7]$/.test(day)) return `Unknown weekday "${day}" (use 1=Mon … 7=Sun)`;
    if (!Array.isArray(span) || span.length !== 2) return `Day ${day} needs [open, close]`;
    const [a, b] = span.map(toMinutes);
    if (a === null || b === null || b <= a) return `Day ${day} hours must be HH:MM with close after open`;
  }
  if (!Object.keys(schedule).length) return 'At least one working day is required';
  return null;
}

function isValidTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return true; } catch { return false; }
}

/**
 * Add `minutes` of working time to `start`.
 * calendar = { timezone, schedule, holidays } (holidays as YYYY-MM-DD).
 */
function addBusinessMinutes(start, minutes, calendar = {}) {
  const timeZone = calendar.timezone || 'UTC';
  const schedule = calendar.schedule && Object.keys(calendar.schedule).length ? calendar.schedule : DEFAULT_SCHEDULE;
  const holidays = new Set(calendar.holidays || []);
  let remaining = Math.max(0, Math.round(minutes));
  let cursor = new Date(start);

  // Walk day by day; a year of closed days means a broken calendar, so stop there
  for (let i = 0; i < 400; i++) {
    const p = partsIn(cursor, timeZone);
    const span = holidays.has(p.ymd) ? null : schedule[String(p.weekday)];
    if (span) {
      const open = toMinutes(span[0]);
      const close = toMinutes(span[1]);
      const from = Math.max(p.minuteOfDay, open);
      if (from < close) {
        const available = close - from;
        if (remaining <= available) return instantAt(p.ymd, from + remaining, timeZone);
        remaining -= available;
      }
    }
    // Jump to the start of the next calendar day in the org's timezone
    const next = new Date(instantAt(p.ymd, 0, timeZone).getTime() + DAY_MS + 2 * 60 * 60 * 1000);
    cursor = instantAt(partsIn(next, timeZone).ymd, 0, timeZone);
  }
  // Fallback: plain wall-clock minutes
  return new Date(new Date(start).getTime() + minutes * 60000);
}

module.exports = { addBusinessMinutes, validateSchedule, isValidTimeZone, DEFAULT_SCHEDULE };

import api from './api';

/**
 * Whole-collection reads for the views that draw one mark per record — the
 * estate map, the change forward window, the change calendar.
 *
 * The API's `validatePagination` caps `limit` at 100 and **rejects anything
 * larger with a 400 rather than clamping it** (see
 * `backend/src/middleware/validator.js`). A view that asked for `limit: 500`
 * therefore got no data at all, and rendered a confident row of zeros above a
 * table that was showing real records. Never raise PAGE_SIZE past the API cap.
 *
 * Paging is bounded on purpose: page 1 tells us `totalPages`, the remaining
 * pages are fetched in parallel, and anything past MAX_PAGES is reported as
 * `truncated` so the caller can say so in the UI instead of quietly under-
 * counting. Aggregate KPIs should come from a `/stats` endpoint where one
 * exists — a census is for the marks, not for the numbers.
 */

/** The API's hard cap on `limit`. Requests above this are rejected with a 400. */
export const CENSUS_PAGE_SIZE = 100;

/** Upper bound on pages fetched, i.e. 1,200 records. Keeps a large tenant from
 *  firing an unbounded fan-out on every mount. */
export const CENSUS_MAX_PAGES = 12;

export interface Census<T> {
  /** Records actually fetched — at most CENSUS_PAGE_SIZE * CENSUS_MAX_PAGES. */
  items: T[];
  /** Server-reported total for the query, independent of what was fetched. */
  total: number;
  /** True when `total` exceeds what the bound allowed us to fetch. */
  truncated: boolean;
}

/** Most endpoints put the rows straight in `data`; a few nest them under a key
 *  (e.g. on-call history returns `{ schedules, recentIncidents }`). */
export type RowSelector<T> = (data: unknown) => T[];

const defaultSelect: RowSelector<unknown> = (data) => (Array.isArray(data) ? data : []);

interface Envelope {
  data?: unknown;
  pagination?: { total?: number; totalPages?: number };
}

function unwrap<T>(payload: Envelope, select: RowSelector<T>): { rows: T[]; total: number; totalPages: number } {
  const rows: T[] = select(payload?.data) ?? [];
  const total: number = payload?.pagination?.total ?? rows.length;
  const totalPages: number = payload?.pagination?.totalPages ?? 1;
  return { rows, total, totalPages };
}

/**
 * Read an entire paginated collection, bounded.
 *
 * @param path    API path without query string, e.g. `/assets`.
 * @param filters Extra query params; `page` and `limit` are managed here.
 * @param select  Pulls the row array out of the envelope's `data`.
 */
export async function fetchCensus<T>(
  path: string,
  filters: Record<string, unknown> = {},
  select: RowSelector<T> = defaultSelect as RowSelector<T>,
): Promise<Census<T>> {
  const qs = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v != null && v !== '') params.append(k, String(v));
    });
    params.set('page', String(page));
    params.set('limit', String(CENSUS_PAGE_SIZE));
    return params.toString();
  };

  const { data: first } = await api.get(`${path}?${qs(1)}`);
  const { rows, total, totalPages } = unwrap<T>(first, select);

  if (totalPages <= 1) return { items: rows, total, truncated: false };

  const lastPage = Math.min(totalPages, CENSUS_MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, i) =>
      api.get(`${path}?${qs(i + 2)}`).then((r) => unwrap<T>(r.data, select).rows),
    ),
  );

  return {
    items: rows.concat(...rest),
    total,
    truncated: totalPages > CENSUS_MAX_PAGES,
  };
}

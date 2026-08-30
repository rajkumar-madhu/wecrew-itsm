import api from './api';

/**
 * The API's `validatePagination` middleware rejects `limit > 100` with a 400
 * (backend `src/middleware/validator.js`). A widget that needs a census of a
 * whole collection — an estate map, a forward schedule, a coverage ribbon —
 * therefore cannot ask for it in a single request, however large the number it
 * passes. It has to walk the pages.
 */
export const MAX_PAGE_LIMIT = 100;

/**
 * Ceiling on the walk so a census against a large tenant cannot fan out without
 * bound. Twenty pages is 2,000 records — past that the caller gets a `truncated`
 * flag and is expected to say so rather than quietly under-report.
 */
export const DEFAULT_MAX_PAGES = 20;

export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  /** Most controllers report `pages`; `/auth/users` reports `totalPages`. Read
   *  both — treating a missing key as "one page" would silently stop the walk
   *  after the first request. */
  pages?: number;
  totalPages?: number;
}

/** The server envelope: `{ data, pagination }`, where `data` is usually the
 *  array itself but is occasionally an object wrapping one. */
export interface PagedBody {
  data?: unknown;
  pagination?: PaginationMeta;
}

export interface Census<T> {
  items: T[];
  /** Server-reported size of the whole collection, even when `items` is capped. */
  total: number;
  /** True when `maxPages` cut the walk short, so `items` is only a prefix. */
  truncated: boolean;
}

interface FetchAllOptions<T> {
  params?: Record<string, unknown>;
  /** Pull the array out of a non-standard envelope (default: `body.data`). */
  select?: (body: PagedBody) => T[];
  maxPages?: number;
}

/**
 * Read every page of a paginated collection endpoint and concatenate them.
 *
 * Failures are not swallowed: the rejection propagates to TanStack Query so the
 * caller sees `isError` rather than an empty array that renders as a legitimate
 * zero. That distinction is the whole point — a census that fails silently is
 * indistinguishable from an empty estate.
 */
export async function fetchAllPages<T>(
  path: string,
  { params = {}, select, maxPages = DEFAULT_MAX_PAGES }: FetchAllOptions<T> = {}
): Promise<Census<T>> {
  const items: T[] = [];
  let total = 0;
  let pages = 1;
  let page = 1;

  do {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') query.append(k, String(v));
    });
    query.set('page', String(page));
    query.set('limit', String(MAX_PAGE_LIMIT));

    const { data: body } = await api.get<PagedBody>(`${path}?${query}`);
    const batch = (select ? select(body) : (body?.data as T[] | undefined)) ?? [];
    items.push(...batch);

    const meta: PaginationMeta = body?.pagination ?? {};
    total = meta.total ?? items.length;
    pages = meta.pages ?? meta.totalPages ?? 1;

    // An endpoint that returns no rows has nothing further to give; stop rather
    // than spin on the next page until maxPages runs out.
    if (batch.length === 0) break;
    page += 1;
  } while (page <= pages && page <= maxPages);

  return { items, total, truncated: pages > maxPages };
}

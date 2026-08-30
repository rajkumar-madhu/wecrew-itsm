import { useQuery } from '@tanstack/react-query';
import { fetchAllPages } from '../lib/pagination';

/**
 * Every user in the tenant, walked a page at a time and deliberately unfiltered.
 *
 * The Users page's hero counts — admins, locked accounts — describe the whole
 * organisation, so they cannot be computed from the table's current page. They
 * also must not follow the table's filters: narrowing the list to ENGINEERs
 * should not make the organisation appear to have no admins.
 *
 * Note `/auth/users` is not behind `validatePagination`; it clamps `limit` to
 * 100 itself while still deriving `skip` from the raw value, so asking for a
 * large page there silently skips records. Walking at the cap avoids that.
 */
export function useUserCensus<T = unknown>() {
  return useQuery({
    queryKey: ['users', 'census'],
    queryFn: () => fetchAllPages<T>('/auth/users'),
    staleTime: 60000,
  });
}

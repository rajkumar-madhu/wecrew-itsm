import axios from 'axios';

/*
  Axios instance for unauthenticated public-site requests (the pilot / demo
  lead form).

  Deliberately separate from `src/lib/api.ts`. That instance carries the auth
  interceptors: on any 401 it tries a token refresh, and when there is no
  refresh token — which is always the case for an anonymous visitor — it clears
  storage and hard-navigates to /login. A marketing-page form must never throw a
  visitor out to a login screen because the API answered 401, so the public
  client has no interceptors at all and lets the caller handle the error.

  Same baseURL resolution as the authenticated client so both follow the Vite
  proxy in dev and the nginx /api/ proxy in production.
*/
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

export default publicApi;

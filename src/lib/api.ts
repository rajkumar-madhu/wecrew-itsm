import axios from 'axios';

/* Storage key for the persisted auth blob.
   This was previously a function that called ITSELF before returning, recursing
   ~9,000 frames until the RangeError was swallowed by its own try/catch — about
   0.33ms burned on every call, and it is called once per request in the
   interceptor below. The legacy `linkedeye-auth` -> `wecrew-auth` migration it
   was attempting already happens correctly in authStore's onRehydrateStorage. */
const AUTH_STORAGE_KEY = 'wecrew-auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor: attach Bearer token + org header
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const { state } = JSON.parse(stored);
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`;
      if (state?.selectedOrgId) config.headers['X-Organization-Id'] = state.selectedOrgId;
    }
  } catch {}
  return config;
});

// Response interceptor: handle 401 refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (r: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      const refreshToken = stored ? JSON.parse(stored).state?.refreshToken : null;
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
      const newToken = data.data.accessToken;
      const newRefresh = data.data.refreshToken;

      const current = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
      current.state = { ...current.state, token: newToken, refreshToken: newRefresh };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(current));

      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

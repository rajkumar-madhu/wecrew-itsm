import axios from 'axios';

function getAuthStorageKey() {
  try {
    if (!localStorage.getItem(getAuthStorageKey())) {
      const legacy = localStorage.getItem('linkedeye-auth');
      if (legacy) {
        localStorage.setItem(getAuthStorageKey(), legacy);
        localStorage.removeItem('linkedeye-auth');
      }
    }
  } catch {}
  return 'wecrew-auth';
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor: attach Bearer token + org header
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem(getAuthStorageKey());
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
      const stored = localStorage.getItem(getAuthStorageKey());
      const refreshToken = stored ? JSON.parse(stored).state?.refreshToken : null;
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
      const newToken = data.data.accessToken;
      const newRefresh = data.data.refreshToken;

      const current = JSON.parse(localStorage.getItem(getAuthStorageKey()) || '{}');
      current.state = { ...current.state, token: newToken, refreshToken: newRefresh };
      localStorage.setItem(getAuthStorageKey(), JSON.stringify(current));

      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      localStorage.removeItem(getAuthStorageKey());
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

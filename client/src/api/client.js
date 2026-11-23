import axios from 'axios';

// Production: VITE_API_URL points to Render. Development: relative /api (proxied by Vite).
const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export const api = axios.create({ baseURL: apiBase, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('acxiom_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Session expired or revoked: clear the session and return to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const onLogin = window.location.pathname.startsWith('/login');
    if (err.response?.status === 401 && !onLogin) {
      localStorage.removeItem('acxiom_token');
      localStorage.removeItem('acxiom_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const getErrorMessage = (err) =>
  err.response?.data?.message || (err.code === 'ECONNABORTED' ? 'The request timed out.' : 'Unable to reach the server. Please try again.');

export const getFieldErrors = (err) => err.response?.data?.errors || {};

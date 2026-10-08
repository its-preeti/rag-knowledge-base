import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const api = axios.create({
  baseURL: 'https://rag-knowledge-base-8p3i.onrender.com/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const {
        refreshToken,
        userId,
        setTokens,
        logout,
      } = useAuthStore.getState();

      if (refreshToken && userId) {
        try {
          const response = await axios.post(
            'https://rag-knowledge-base-8p3i.onrender.com/api/auth/refresh',
            {
              userId,
              refreshToken,
            },
          );

          const {
            accessToken,
            refreshToken: newRefreshToken,
          } = response.data;

          setTokens(accessToken, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;

          return api(originalRequest);
        } catch {
          logout();
          window.location.href = '/auth/login';
        }
      } else {
        logout();
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  },
);

export default api;

// Auth API
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (data: any) => api.post('/auth/reset-password', data),
};

// Users API
export const usersApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.patch('/users/profile', data),
  changePassword: (data: any) =>
    api.patch('/users/change-password', data),
  getStats: () => api.get('/users/stats'),
};

// Documents API
export const documentsApi = {
  upload: (formData: FormData, onProgress?: (p: number) => void) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),

  uploadMultiple: (
    formData: FormData,
    onProgress?: (p: number) => void,
  ) =>
    api.post('/documents/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),

  getAll: (params: any) => api.get('/documents', { params }),
  getById: (id: string) => api.get(`/documents/${id}`),
  rename: (id: string, name: string) =>
    api.patch(`/documents/${id}/rename`, { name }),
  delete: (id: string) => api.delete(`/documents/${id}`),
  retry: (id: string) => api.post(`/documents/${id}/retry`),
};

// Chat API
export const chatApi = {
  create: (data: any) => api.post('/chats', data),
  getAll: (params: any) => api.get('/chats', { params }),
  getById: (id: string) => api.get(`/chats/${id}`),
  rename: (id: string, title: string) =>
    api.patch(`/chats/${id}/rename`, { title }),
  delete: (id: string) => api.delete(`/chats/${id}`),
  exportPdf: (id: string) =>
    api.get(`/chats/${id}/export/pdf`, { responseType: 'blob' }),
  exportMarkdown: (id: string) =>
    api.get(`/chats/${id}/export/markdown`, {
      responseType: 'blob',
    }),
};

// Search API
export const searchApi = {
  search: (params: any) => api.get('/search', { params }),
  globalSearch: (q: string) =>
    api.get('/search/global', { params: { q } }),
};

// Workspaces API
export const workspacesApi = {
  create: (data: any) => api.post('/workspaces', data),
  getAll: () => api.get('/workspaces'),
  getById: (id: string) => api.get(`/workspaces/${id}`),
  getStats: (id: string) => api.get(`/workspaces/${id}/stats`),
  update: (id: string, data: any) =>
    api.patch(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/workspaces/${id}`),
  addMember: (id: string, data: any) =>
    api.post(`/workspaces/${id}/members`, data),
  removeMember: (id: string, memberId: string) =>
    api.delete(`/workspaces/${id}/members/${memberId}`),
};

// Admin API
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  updateUser: (id: string, data: any) =>
    api.patch(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  getLogs: (params?: any) => api.get('/admin/logs', { params }),
  getAnalytics: (days?: number) =>
    api.get('/admin/analytics', { params: { days } }),
};

// Settings API
export const settingsApi = {
  getAll: () => api.get('/settings'),
  update: (data: any) => api.post('/settings', data),
};



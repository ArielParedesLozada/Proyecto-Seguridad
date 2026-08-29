export const API_ROUTES = {
  BASE_URL: '/api',
  auth: {
    login: '/auth/login',
    me: '/auth/me',
    logout: '/auth/logout',
  },
  projects: {
    root: '/projects',
    byId: (id: string) => `/projects/${encodeURIComponent(id)}`,
    copy: (id: string) => `/projects/${encodeURIComponent(id)}/copy`,
  },
} as const;

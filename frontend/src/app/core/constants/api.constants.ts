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
    files: {
      root: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/files`,
      byId: (projectId: string, fileId: string) =>
        `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
      content: (projectId: string, fileId: string) =>
        `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/content`,
    },
  },
} as const;

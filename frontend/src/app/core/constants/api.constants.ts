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
    compile: (id: string) => `/projects/${encodeURIComponent(id)}/compile`,
    files: {
      root: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/files`,
      byId: (projectId: string, fileId: string) =>
        `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
      content: (projectId: string, fileId: string) =>
        `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/content`,
    },
    invitations: {
      root: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/invitations`,
      byId: (projectId: string, invitationId: string) =>
        `/projects/${encodeURIComponent(projectId)}/invitations/${encodeURIComponent(invitationId)}`,
      resend: (projectId: string, invitationId: string) =>
        `/projects/${encodeURIComponent(projectId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
    },
  },
  invitations: {
    byToken: (token: string) => `/invitations/${encodeURIComponent(token)}`,
    accept: (token: string) => `/invitations/${encodeURIComponent(token)}/accept`,
  },
  crypto: {
    session: '/crypto/session',
  },
} as const;

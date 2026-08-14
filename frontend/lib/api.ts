// API Client for Fluxnote Backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to get auth token
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// Helper to make authenticated requests
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge existing headers
  if (options.headers) {
    const existingHeaders = options.headers as Record<string, string>;
    Object.assign(headers, existingHeaders);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// AUTH API
// ============================================================================

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token?: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  message?: string;
}

export const authApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    return fetchWithAuth('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    return fetchWithAuth('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: async () => {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore audit failures
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }
  },

  syncProfile: async (): Promise<any> => {
    return fetchWithAuth('/api/auth/sync-profile', { method: 'POST' });
  },

  saveAuth: (token: string, user: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
  },

  getUser: () => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
};

// ============================================================================
// CANVAS API
// ============================================================================

export interface CanvasNode {
  id: string;
  type: string;
  content: any;
  position: { x: number; y: number };
  intent?: string;
  locked?: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CanvasState {
  roomId: string;
  nodes: CanvasNode[];
  version: number;
}

export const canvasApi = {
  getCanvas: async (roomId: string): Promise<CanvasState> => {
    return fetchWithAuth(`/api/canvas/${roomId}`);
  },

  resetCanvas: async (roomId: string): Promise<{ message: string }> => {
    return fetchWithAuth(`/api/canvas/${roomId}/reset`, {
      method: 'POST',
    });
  },

  exportCanvas: async (roomId: string): Promise<any> => {
    return fetchWithAuth(`/api/canvas/${roomId}/export`);
  },

  lockNode: async (nodeId: string, locked: boolean): Promise<any> => {
    return fetchWithAuth(`/api/nodes/${nodeId}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({ locked }),
    });
  },

  setNodeAcl: async (nodeId: string, acl: any): Promise<any> => {
    return fetchWithAuth(`/api/nodes/${nodeId}/acl`, {
      method: 'PATCH',
      body: JSON.stringify({ acl }),
    });
  },
};

// ============================================================================
// TASKS API
// ============================================================================

export interface Task {
  id: string;
  roomId: string;
  nodeId: string;
  text: string;       // backend field name
  status: 'todo' | 'in_progress' | 'done';
  authorId: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

export const tasksApi = {
  getTasks: async (roomId: string): Promise<Task[]> => {
    try {
      const res = await fetchWithAuth(`/api/tasks/${roomId}`);
      return res.tasks ?? res ?? [];
    } catch {
      // Silently return empty — tasks are non-critical
      return [];
    }
  },

  updateTaskStatus: async (
    taskId: string,
    status: Task['status']
  ): Promise<Task> => {
    const res = await fetchWithAuth(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    // Backend returns { success: true, task: {...} }
    return res.task ?? res;
  },
};

// ============================================================================
// ROOMS API (if you add room management endpoints)
// ============================================================================

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export const roomsApi = {
  createRoom: async (name: string): Promise<Room> => {
    const res = await fetchWithAuth('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return res.room ?? res;
  },

  getRooms: async (): Promise<Room[]> => {
    try {
      const res = await fetchWithAuth('/api/rooms');
      return res.rooms ?? res ?? [];
    } catch {
      return [];
    }
  },

  getRoom: async (roomId: string): Promise<Room> => {
    const res = await fetchWithAuth(`/api/rooms/${roomId}`);
    return res.room ?? res;
  },
};

// ============================================================================
// WORKSPACES API
// ============================================================================

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  role?: string;
}

export interface WorkspaceMember {
  id: string;
  role: string;
  joinedAt: string;
  profile: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export const workspacesApi = {
  getWorkspaces: async (): Promise<Workspace[]> => {
    try {
      const res = await fetchWithAuth('/api/workspaces');
      return res.workspaces ?? res ?? [];
    } catch {
      return [];
    }
  },
  getPrimary: async (): Promise<Workspace | null> => {
    try {
      const res = await fetchWithAuth('/api/workspaces/primary');
      return res.workspace ?? null;
    } catch {
      return null;
    }
  },
  createWorkspace: async (name: string, slug?: string): Promise<Workspace> => {
    const res = await fetchWithAuth('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    return res.workspace ?? res;
  },
  getWorkspace: async (workspaceId: string): Promise<Workspace> => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}`);
    return res.workspace ?? res;
  },
  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/members`);
    return res.members ?? res;
  },
  addMember: async (workspaceId: string, email: string, role: string): Promise<any> => {
    return fetchWithAuth(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },
  updateMemberRole: async (workspaceId: string, memberId: string, role: string): Promise<any> => {
    return fetchWithAuth(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },
};

// ============================================================================
// SHARING API
// ============================================================================

export interface ShareSettings {
  share: {
    id: string;
    room_id: string;
    access_type: 'anyone_with_link' | 'restricted';
    link_role: 'viewer' | 'contributor' | 'lead';
    token: string;
    expires_at: string | null;
    created_at: string;
  } | null;
  invites: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    user_id: string | null;
    created_at: string;
  }>;
}

export const sharingApi = {
  getShareSettings: async (roomId: string): Promise<ShareSettings> => {
    try {
      const res = await fetchWithAuth(`/api/rooms/${roomId}/share`);
      return res ?? { share: null, invites: [] };
    } catch {
      return { share: null, invites: [] };
    }
  },

  updateShareSettings: async (
    roomId: string,
    settings: {
      accessType?: 'anyone_with_link' | 'restricted';
      linkRole?: 'viewer' | 'contributor' | 'lead';
    }
  ): Promise<any> => {
    return fetchWithAuth(`/api/rooms/${roomId}/share`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  addInvites: async (
    roomId: string,
    emails: string[],
    role: 'viewer' | 'contributor' | 'lead' = 'viewer'
  ): Promise<any> => {
    return fetchWithAuth(`/api/rooms/${roomId}/share/invites`, {
      method: 'POST',
      body: JSON.stringify({ emails, role }),
    });
  },

  revokeInvite: async (roomId: string, inviteId: string): Promise<any> => {
    return fetchWithAuth(`/api/rooms/${roomId}/share/invites/${inviteId}`, {
      method: 'DELETE',
    });
  },

  validateShareToken: async (token: string): Promise<{ roomId: string; role: string } | null> => {
    try {
      return await fetchWithAuth(`/api/share/validate/${token}`);
    } catch {
      return null;
    }
  },

  getSharedWithMe: async (): Promise<Room[]> => {
    try {
      const res = await fetchWithAuth('/api/share/shared-with-me');
      return res.rooms ?? [];
    } catch {
      return [];
    }
  },

  getShareLink: (roomId: string, token: string): string => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/lobby?roomId=${roomId}&token=${token}`;
  },
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  auth: authApi,
  canvas: canvasApi,
  tasks: tasksApi,
  rooms: roomsApi,
  sharing: sharingApi,
};

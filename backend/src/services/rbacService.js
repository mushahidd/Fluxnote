// canMutate(userId, nodeId, action, accessToken)
//   → fetch workspace role via RLS
//   → fallback: check room_share_invites for cross-workspace shared access
//   → check node permissions with role_required + permission
//   → return true/false
//
// Node permissions schema: role_required + permission
// Viewers can NEVER mutate — enforced HERE on server
// This is called in wsHandler BEFORE applying any mutation

const { getSupabaseClientForToken, getSupabaseServiceClient } = require('../utils/supabase');

const ROLE_RANK = {
  viewer: 1,
  contributor: 2,
  lead: 3,
  owner: 4,
};

const PERMISSION_RANK = {
  none: 0,
  view: 1,
  comment: 2,
  edit: 3,
};

function normalizeRole(role) {
  if (!role) return null;
  const normalized = String(role).toLowerCase();

  if (normalized === 'owner') return 'owner';
  if (normalized === 'lead') return 'lead';
  if (normalized === 'contributor') return 'contributor';
  if (normalized === 'viewer') return 'viewer';

  return null;
}

function toAllowedRoles(roleRequired) {
  const role = normalizeRole(roleRequired);
  if (!role) return ['Lead', 'Contributor'];

  if (role === 'owner') return ['Owner'];
  if (role === 'lead') return ['Lead'];
  if (role === 'contributor') return ['Lead', 'Contributor'];
  if (role === 'viewer') return ['Lead', 'Contributor', 'Viewer'];

  return ['Lead', 'Contributor'];
}

function requiredPermissionForAction(action) {
  if (action === 'view') return 'view';
  if (action === 'comment') return 'comment';
  return 'edit';
}

async function getWorkspaceRoleForRoom(userId, roomId, accessToken, userEmail) {
  const client = getSupabaseClientForToken(accessToken);
  if (!client) return null;

  const { data: room, error: roomError } = await client
    .from('rooms')
    .select('workspace_id')
    .eq('id', roomId)
    .maybeSingle();

  if (roomError || !room?.workspace_id) {
    return null;
  }

  const { data: membership } = await client
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', room.workspace_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership?.role) {
    return normalizeRole(membership.role);
  }

  // Fallback: check if user has a share invite for this room (cross-workspace access)
  const serviceClient = getSupabaseServiceClient();
  if (serviceClient && userEmail) {
    const { data: invite } = await serviceClient
      .from('room_share_invites')
      .select('role, status')
      .eq('room_id', roomId)
      .or(`user_id.eq.${userId},email.eq.${userEmail.toLowerCase()}`)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (invite?.role) {
      return normalizeRole(invite.role);
    }
  }

  // Fallback: check anyone_with_link share
  if (serviceClient) {
    const { data: share } = await serviceClient
      .from('room_shares')
      .select('access_type, link_role')
      .eq('room_id', roomId)
      .maybeSingle();

    if (share?.access_type === 'anyone_with_link') {
      return normalizeRole(share.link_role);
    }
  }

  return null;
}

async function getWorkspaceRoleForWorkspace(userId, workspaceId, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  if (!client) return null;

  const { data: membership, error } = await client
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !membership?.role) {
    return null;
  }

  return normalizeRole(membership.role);
}

async function getWorkspaceRoleForNode(userId, nodeId, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  if (!client) return null;

  const { data: node, error: nodeError } = await client
    .from('canvas_nodes')
    .select('room_id')
    .eq('id', nodeId)
    .maybeSingle();

  if (nodeError || !node?.room_id) {
    return null;
  }

  return getWorkspaceRoleForRoom(userId, node.room_id, accessToken);
}

/**
 * Check if user can mutate a node based on ACL
 * @param {string} userId - User ID
 * @param {string} nodeId - Node ID
 * @param {string} action - Action type (update, delete, lock, etc.)
 * @returns {Promise<boolean>}
 */
async function canMutate(userId, nodeId, action, accessToken) {
  try {
    const client = getSupabaseClientForToken(accessToken);
    if (!client) return false;

    const workspaceRole = await getWorkspaceRoleForNode(userId, nodeId, accessToken);
    const normalizedRole = normalizeRole(workspaceRole);

    if (!normalizedRole) {
      return false;
    }

    const roleRank = ROLE_RANK[normalizedRole] || 0;

    // Viewers can NEVER mutate anything
    if (normalizedRole === 'viewer') {
      return false;
    }

    // Leads/owners can do everything
    if (normalizedRole === 'lead' || normalizedRole === 'owner') {
      return true;
    }

    const { data: nodePermission, error: permissionError } = await client
      .from('node_permissions')
      .select('permission, role_required')
      .eq('node_id', nodeId)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('user_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (permissionError) {
      return false;
    }

    if (!nodePermission) {
      return roleRank >= ROLE_RANK.contributor;
    }

    const requiredRole = normalizeRole(nodePermission.role_required) || 'contributor';
    const requiredRoleRank = ROLE_RANK[requiredRole] || 0;

    if (roleRank < requiredRoleRank) {
      return false;
    }

    const requiredPermission = requiredPermissionForAction(action);
    const permissionRank = PERMISSION_RANK[nodePermission.permission] || 0;
    const requiredRank = PERMISSION_RANK[requiredPermission] || 0;

    return permissionRank >= requiredRank;
  } catch (error) {
    console.error('RBAC check error:', error);
    return false;
  }
}

/**
 * Set node ACL (allowed roles)
 * @param {string} nodeId - Node ID
 * @param {string} roomId - Room ID
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Promise<Object>}
 */
async function setNodeAcl(nodeId, roomId, allowedRoles, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  if (!client) return null;

  const normalizedRoles = Array.isArray(allowedRoles)
    ? allowedRoles.map(normalizeRole).filter(Boolean)
    : [];

  const minRoleRank = normalizedRoles.reduce((minRank, role) => {
    const rank = ROLE_RANK[role] || 0;
    return Math.min(minRank, rank || minRank);
  }, ROLE_RANK.lead);

  const roleRequired = Object.keys(ROLE_RANK).find(
    (role) => ROLE_RANK[role] === minRoleRank
  ) || 'contributor';

  const { data: existing, error: existingError } = await client
    .from('node_permissions')
    .select('id')
    .eq('node_id', nodeId)
    .is('user_id', null)
    .maybeSingle();

  if (existingError) {
    return null;
  }

  if (existing?.id) {
    const { data, error } = await client
      .from('node_permissions')
      .update({ role_required: roleRequired, permission: 'edit' })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();

    if (error) return null;
    return { ...data, allowedRoles: toAllowedRoles(roleRequired) };
  }

  const { data, error } = await client
    .from('node_permissions')
    .insert({
      node_id: nodeId,
      user_id: null,
      role_required: roleRequired,
      permission: 'edit',
    })
    .select('*')
    .maybeSingle();

  if (error) return null;
  return { ...data, allowedRoles: toAllowedRoles(roleRequired) };
}

/**
 * Get node ACL
 * @param {string} nodeId - Node ID
 * @returns {Promise<Object|null>}
 */
async function getNodeAcl(nodeId, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  if (!client) return null;

  const { data, error } = await client
    .from('node_permissions')
    .select('permission, role_required')
    .eq('node_id', nodeId)
    .is('user_id', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    permission: data.permission,
    roleRequired: data.role_required,
    allowedRoles: toAllowedRoles(data.role_required),
  };
}

/**
 * Check if user has specific role
 * @param {string} userId - User ID
 * @param {string} requiredRole - Required role (Lead, Contributor, Viewer)
 * @returns {Promise<boolean>}
 */
async function hasRole(userId, requiredRole, roomId, accessToken) {
  if (!roomId) return false;

  const workspaceRole = await getWorkspaceRoleForRoom(userId, roomId, accessToken);
  const normalizedRole = normalizeRole(workspaceRole);
  const normalizedRequired = normalizeRole(requiredRole);

  if (!normalizedRole || !normalizedRequired) return false;

  return ROLE_RANK[normalizedRole] >= ROLE_RANK[normalizedRequired];
}

module.exports = {
  canMutate,
  setNodeAcl,
  getNodeAcl,
  hasRole,
  getWorkspaceRoleForRoom,
  getWorkspaceRoleForNode,
  getWorkspaceRoleForWorkspace,
};

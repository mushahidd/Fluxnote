// Express middleware factory: requireRole("Lead")
// Checks req.user.role against allowed roles
// Used on REST routes like /nodes/:id/lock

const rbacService = require('../services/rbacService');

/**
 * Role-based access control middleware factory
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roomId = req.params.roomId || req.body.roomId || req.query.roomId;
    const nodeId = req.params.nodeId || req.params.id || req.body.nodeId;

    let workspaceRole = req.user.role;
    if (req.accessToken && roomId) {
      workspaceRole = await rbacService.getWorkspaceRoleForRoom(req.user.id, roomId, req.accessToken, req.user.email);
    } else if (req.accessToken && nodeId) {
      workspaceRole = await rbacService.getWorkspaceRoleForNode(req.user.id, nodeId, req.accessToken);
    }

    // If no workspace role found, check if room has no workspace (allow lead role by default)
    if (!workspaceRole && roomId) {
      const { getSupabaseServiceClient } = require('../utils/supabase');
      const serviceClient = getSupabaseServiceClient();
      if (serviceClient) {
        const { data: room } = await serviceClient
          .from('rooms')
          .select('workspace_id')
          .eq('id', roomId)
          .maybeSingle();
        
        // If room has no workspace, grant lead role by default
        if (room && !room.workspace_id) {
          workspaceRole = 'lead';
        }
      }
    }

    const normalizedRole = workspaceRole ? String(workspaceRole).toLowerCase() : null;
    const normalizedAllowed = allowedRoles.map((role) => String(role).toLowerCase());

    const roleRank = {
      viewer: 1,
      contributor: 2,
      lead: 3,
      owner: 4,
    }[normalizedRole] || 0;

    const minAllowedRank = normalizedAllowed.reduce((minRank, role) => {
      const rank = {
        viewer: 1,
        contributor: 2,
        lead: 3,
        owner: 4,
      }[role] || 0;
      return Math.min(minRank, rank || minRank);
    }, 4);

    if (!roleRank || roleRank < minAllowedRank) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: workspaceRole || req.user.role,
      });
    }

    next();
  };
}

/**
 * Node-level RBAC middleware
 * Checks if user can mutate a specific node based on node ACL
 * Requires nodeId in req.params
 */
function checkNodePermission(action = 'update') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const nodeId = req.params.nodeId || req.params.id;
    if (!nodeId) {
      return res.status(400).json({ error: 'Node ID required' });
    }

    try {
      const canMutate = await rbacService.canMutate(req.user.id, nodeId, action, req.accessToken);
      
      if (!canMutate) {
        return res.status(403).json({ 
          error: 'You do not have permission to modify this node',
          nodeId,
          action,
        });
      }

      next();
    } catch (error) {
      console.error('RBAC check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = {
  requireRole,
  checkNodePermission,
  requireWorkspaceRole,
};

/**
 * Workspace-level RBAC middleware factory
 * Uses workspace_members to validate the user's role in a workspace
 */
function requireWorkspaceRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId required' });
    }

    const workspaceRole = await rbacService.getWorkspaceRoleForWorkspace(
      req.user.id,
      workspaceId,
      req.accessToken
    );

    const normalizedRole = workspaceRole ? String(workspaceRole).toLowerCase() : null;
    const normalizedAllowed = allowedRoles.map((role) => String(role).toLowerCase());

    const roleRank = {
      viewer: 1,
      contributor: 2,
      lead: 3,
      owner: 4,
    }[normalizedRole] || 0;

    const minAllowedRank = normalizedAllowed.reduce((minRank, role) => {
      const rank = {
        viewer: 1,
        contributor: 2,
        lead: 3,
        owner: 4,
      }[role] || 0;
      return Math.min(minRank, rank || minRank);
    }, 4);

    if (!roleRank || roleRank < minAllowedRank) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: workspaceRole,
      });
    }

    next();
  };
}

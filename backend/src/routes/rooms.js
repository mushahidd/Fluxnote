// Rooms API
// GET  /api/rooms         → list rooms for authenticated user
// POST /api/rooms         → create a new room
// GET  /api/rooms/:roomId → get a single room

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getSupabaseClientForToken, getSupabaseServiceClient } = require('../utils/supabase');
const { getPrimaryWorkspace } = require('../services/workspaceService');

// List rooms (rooms the user has access to via workspace membership)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const serviceClient = getSupabaseServiceClient();
    const client = serviceClient || getSupabaseClientForToken(req.accessToken);
    if (!client) return res.json({ rooms: [] });

    const userId = req.user.id;

    // Get all workspace IDs this user is a member of
    const { data: memberships, error: memberError } = await client
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);

    if (memberError) {
      console.warn('Workspace membership query error:', memberError.message);
      return res.json({ rooms: [] });
    }

    const workspaceIds = (memberships || [])
      .map(m => m.workspace_id)
      .filter(Boolean);

    // No workspace memberships → no rooms
    if (workspaceIds.length === 0) {
      return res.json({ rooms: [] });
    }

    // Return only rooms that belong to this user's workspaces
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .in('workspace_id', workspaceIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Rooms query error (returning empty):', error.message);
      return res.json({ rooms: [] });
    }

    res.json({ rooms: data || [] });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.json({ rooms: [] });
  }
});

// Create a room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, workspaceId } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name (string) required' });
    }

    const serviceClient = getSupabaseServiceClient();
    const client = serviceClient || getSupabaseClientForToken(req.accessToken);
    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      const workspace = await getPrimaryWorkspace(req.user.id, req.accessToken);
      targetWorkspaceId = workspace?.id;
    }

    // If still no workspace, auto-create one for this user so the room is always owned
    if (!targetWorkspaceId) {
      const { ensureWorkspaceForUser } = require('../services/workspaceService');
      const workspace = await ensureWorkspaceForUser(req.user, req.accessToken);
      targetWorkspaceId = workspace?.id;
    }

    if (!targetWorkspaceId) {
      return res.status(400).json({ error: 'Could not resolve a workspace for this user' });
    }

    const { data, error } = await client
      .from('rooms')
      .insert({ name, status: 'active', workspace_id: targetWorkspaceId })
      .select('*')
      .maybeSingle();

    if (error || !data) {
      console.error('Create room error:', error);
      return res.status(500).json({ error: 'Failed to create room' });
    }

    res.status(201).json({ room: data });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get a single room
router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const client = getSupabaseClientForToken(req.accessToken);
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room: data });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Update member role in a room
router.post('/:roomId/members/:userId/role', authenticateToken, async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const { role } = req.body;
    const { broadcast } = require('../ws/wsServer');

    // Validate role
    const validRoles = ['viewer', 'contributor', 'lead'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid role. Must be viewer, contributor, or lead' });
    }

    const serviceClient = getSupabaseServiceClient();
    if (!serviceClient) {
      return res.status(500).json({ error: 'Database client not available' });
    }

    // Get room's workspace
    const { data: room } = await serviceClient
      .from('rooms')
      .select('workspace_id')
      .eq('id', roomId)
      .maybeSingle();

    if (!room?.workspace_id) {
      return res.status(404).json({ error: 'Room not found or has no workspace' });
    }

    // Update workspace member role
    const { data, error } = await serviceClient
      .from('workspace_members')
      .update({ role: role.toLowerCase() })
      .eq('workspace_id', room.workspace_id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Update role error:', error);
      return res.status(500).json({ error: 'Failed to update role' });
    }

    // Broadcast role change to all users in room
    broadcast(roomId, {
      type: 'role:changed',
      userId,
      newRole: role.toLowerCase(),
    });

    res.json({ success: true, member: data });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

module.exports = router;

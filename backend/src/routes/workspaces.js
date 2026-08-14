const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireWorkspaceRole } = require('../middleware/rbac');
const { getSupabaseClientForToken } = require('../utils/supabase');
const { getPrimaryWorkspace } = require('../services/workspaceService');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const client = getSupabaseClientForToken(req.accessToken);
    if (!client) return res.json({ workspaces: [] });

    const { data, error } = await client
      .from('workspace_members')
      .select('role, workspaces:workspace_id (id, name, slug, owner_id, created_at)')
      .eq('user_id', req.user.id)
      .order('joined_at', { ascending: true });

    if (error) {
      console.warn('Workspaces query error (returning empty):', error.message);
      return res.json({ workspaces: [] });
    }

    const workspaces = (data || []).map((row) => ({
      ...row.workspaces,
      role: row.role,
    }));

    res.json({ workspaces });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.json({ workspaces: [] });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name (string) required' });
    }

    const client = getSupabaseClientForToken(req.accessToken);
    const { data, error } = await client
      .from('workspaces')
      .insert({
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-').slice(0, 40),
        owner_id: req.user.id,
      })
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return res.status(500).json({ error: 'Failed to create workspace' });
    }

    await client.from('workspace_members').insert({
      workspace_id: data.id,
      user_id: req.user.id,
      role: 'owner',
    });

    res.status(201).json({ workspace: data });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

router.get('/primary', authenticateToken, async (req, res) => {
  try {
    const workspace = await getPrimaryWorkspace(req.user.id, req.accessToken);
    res.json({ workspace: workspace || null });
  } catch (error) {
    console.warn('Get primary workspace error (returning null):', error.message);
    res.json({ workspace: null });
  }
});

router.get('/:workspaceId', authenticateToken, async (req, res) => {
  try {
    const client = getSupabaseClientForToken(req.accessToken);
    const { data, error } = await client
      .from('workspaces')
      .select('*')
      .eq('id', req.params.workspaceId)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ workspace: data });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

router.get('/:workspaceId/members', authenticateToken, async (req, res) => {
  try {
    const client = getSupabaseClientForToken(req.accessToken);
    if (!client) return res.json({ members: [] });

    const { data, error } = await client
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', req.params.workspaceId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.warn('Members query error (returning empty):', error.message);
      return res.json({ members: [] });
    }

    const members = (data || []).map((row) => ({
      id: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      profile: null,
    }));

    res.json({ members });
  } catch (error) {
    console.error('Get members error:', error);
    res.json({ members: [] });
  }
});

router.post('/:workspaceId/members', authenticateToken, requireWorkspaceRole('owner', 'lead'), async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email (string) required' });
    }

    const validRoles = ['owner', 'lead', 'contributor', 'viewer'];
    const memberRole = role || 'contributor';
    if (!validRoles.includes(memberRole)) {
      return res.status(400).json({ error: 'Invalid role', valid: validRoles });
    }

    const client = getSupabaseClientForToken(req.accessToken);
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, email, display_name')
      .eq('email', email)
      .maybeSingle();

    if (userError || !user?.id) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data, error } = await client
      .from('workspace_members')
      .insert({
        workspace_id: req.params.workspaceId,
        user_id: user.id,
        role: memberRole,
      })
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return res.status(500).json({ error: 'Failed to add member' });
    }

    res.status(201).json({ member: data });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.patch('/:workspaceId/members/:memberId', authenticateToken, requireWorkspaceRole('owner', 'lead'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'role (string) required' });
    }

    const validRoles = ['owner', 'lead', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role', valid: validRoles });
    }

    const client = getSupabaseClientForToken(req.accessToken);
    const { data, error } = await client
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', req.params.workspaceId)
      .eq('user_id', req.params.memberId)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return res.status(500).json({ error: 'Failed to update member role' });
    }

    res.json({ member: data });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

module.exports = router;

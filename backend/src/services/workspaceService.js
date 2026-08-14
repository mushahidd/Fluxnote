const { getSupabaseClientForToken, getSupabaseServiceClient } = require('../utils/supabase');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

async function getPrimaryWorkspace(userId, accessToken) {
  // Use service client to bypass RLS issues
  const serviceClient = getSupabaseServiceClient();
  const client = serviceClient || getSupabaseClientForToken(accessToken);
  if (!client) return null;

  const { data, error } = await client
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.workspace_id) {
    console.warn('getPrimaryWorkspace error:', error?.message);
    return null;
  }

  const { data: workspace, error: workspaceError } = await client
    .from('workspaces')
    .select('*')
    .eq('id', data.workspace_id)
    .maybeSingle();

  if (workspaceError) {
    console.warn('getWorkspace error:', workspaceError?.message);
    return null;
  }
  return workspace;
}

async function ensureWorkspaceForUser(user, accessToken) {
  const serviceClient = getSupabaseServiceClient();
  const userClient = getSupabaseClientForToken(accessToken);
  const client = serviceClient || userClient;

  if (!client || !user?.id) return null;

  const { data: existingMembership } = await client
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (existingMembership?.workspace_id) {
    const { data: workspace } = await client
      .from('workspaces')
      .select('*')
      .eq('id', existingMembership.workspace_id)
      .maybeSingle();
    return workspace || null;
  }

  const baseName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || 'Workspace';
  const workspaceName = `${baseName}'s Workspace`;
  const slug = `${slugify(baseName)}-${user.id.slice(0, 6)}`;

  const { data: workspace, error: workspaceError } = await client
    .from('workspaces')
    .insert({
      name: workspaceName,
      slug,
      owner_id: user.id,
    })
    .select('*')
    .maybeSingle();

  if (workspaceError || !workspace) return null;

  await client
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    });

  await client
    .from('rooms')
    .insert({
      workspace_id: workspace.id,
      name: 'Getting Started',
      status: 'active',
    });

  return workspace;
}

module.exports = {
  getPrimaryWorkspace,
  ensureWorkspaceForUser,
};

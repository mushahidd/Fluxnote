// shareService.js
// Handles room-level sharing: link-based (anyone with link) and restricted (email invites)
// Google Drive-style: owner sets access_type + link_role, then optionally invites specific emails

const { getSupabaseClientForToken, getSupabaseServiceClient } = require('../utils/supabase');

/**
 * Get or create the share config for a room.
 * Only leads/owners can call this.
 */
async function getOrCreateShare(roomId, userId, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  const serviceClient = getSupabaseServiceClient();
  const effectiveClient = client || serviceClient;
  
  if (!effectiveClient) throw new Error('No client available');

  // Try to fetch existing
  const { data: existing } = await effectiveClient
    .from('room_shares')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (existing) return existing;

  // Create new share config (default: restricted, viewer role)
  const { data, error } = await effectiveClient
    .from('room_shares')
    .insert({ room_id: roomId, created_by: userId, access_type: 'restricted', link_role: 'viewer' })
    .select('*')
    .maybeSingle();

  if (error || !data) throw new Error(error?.message || 'Failed to create share');
  return data;
}

/**
 * Get share config + invites for a room (for the share modal).
 */
async function getShareSettings(roomId, accessToken, userId) {
  // Use service client to bypass RLS for reading share settings
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) {
    console.warn('Service client not available, falling back to user client');
    const client = getSupabaseClientForToken(accessToken);
    if (!client) return null;
    
    const { data: share } = await client
      .from('room_shares')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (!share) return { share: null, invites: [] };

    const { data: invites } = await client
      .from('room_share_invites')
      .select('id, email, role, status, user_id, created_at')
      .eq('room_id', roomId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: true });

    return { share, invites: invites || [] };
  }

  const { data: share } = await serviceClient
    .from('room_shares')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (!share) return { share: null, invites: [] };

  const { data: invites } = await serviceClient
    .from('room_share_invites')
    .select('id, email, role, status, user_id, created_at')
    .eq('room_id', roomId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: true });

  return { share, invites: invites || [] };
}

/**
 * Update share access type and/or link role.
 * access_type: 'anyone_with_link' | 'restricted'
 * link_role: 'viewer' | 'contributor' | 'lead'
 */
async function updateShareSettings(roomId, userId, { accessType, linkRole }, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  const serviceClient = getSupabaseServiceClient();
  const effectiveClient = client || serviceClient;
  
  if (!effectiveClient) throw new Error('No client available');

  // Ensure share row exists
  await getOrCreateShare(roomId, userId, accessToken);

  const updates = {};
  if (accessType) updates.access_type = accessType;
  if (linkRole) updates.link_role = linkRole;

  const { data, error } = await effectiveClient
    .from('room_shares')
    .update(updates)
    .eq('room_id', roomId)
    .select('*')
    .maybeSingle();

  if (error || !data) throw new Error(error?.message || 'Failed to update share settings');
  return data;
}

/**
 * Add email invites to a room share.
 * Creates invite rows; in production you'd also send emails here.
 */
async function addInvites(roomId, userId, emails, role, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  const serviceClient = getSupabaseServiceClient();
  const effectiveClient = client || serviceClient;
  
  if (!effectiveClient) throw new Error('No client available');

  const share = await getOrCreateShare(roomId, userId, accessToken);

  // Look up user_ids for known emails (best-effort)
  const emailToUserId = {};
  if (serviceClient) {
    const { data: users } = await serviceClient
      .from('users')
      .select('id, email')
      .in('email', emails);
    (users || []).forEach(u => { emailToUserId[u.email] = u.id; });
  }

  const rows = emails.map(email => ({
    room_id: roomId,
    share_id: share.id,
    invited_by: userId,
    email: email.toLowerCase().trim(),
    user_id: emailToUserId[email.toLowerCase().trim()] || null,
    role,
    status: 'pending',
  }));

  // Upsert: if email already invited, update role
  const { data, error } = await effectiveClient
    .from('room_share_invites')
    .upsert(rows, { onConflict: 'room_id,email', ignoreDuplicates: false })
    .select('*');

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Remove an invite by id.
 */
async function revokeInvite(inviteId, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  const serviceClient = getSupabaseServiceClient();
  const effectiveClient = client || serviceClient;
  
  if (!effectiveClient) throw new Error('No client available');

  const { error } = await effectiveClient
    .from('room_share_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);

  if (error) throw new Error(error.message);
}

/**
 * Validate a share token and return { roomId, role } or null.
 * Used by WebSocket auth and REST endpoints to grant access via link.
 */
async function validateShareToken(token) {
  // Use service client — token validation must bypass RLS
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) return null;

  const { data: share, error } = await serviceClient
    .from('room_shares')
    .select('room_id, access_type, link_role, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !share) return null;

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null;

  // Only valid for anyone_with_link mode
  if (share.access_type !== 'anyone_with_link') return null;

  return { roomId: share.room_id, role: share.link_role };
}

/**
 * Check if a user (by email or user_id) has been explicitly invited to a room.
 * Returns the invite row or null.
 */
async function checkEmailInvite(roomId, userEmail, userId) {
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) return null;

  const { data } = await serviceClient
    .from('room_share_invites')
    .select('id, role, status')
    .eq('room_id', roomId)
    .eq('status', 'pending')
    .or(`email.eq.${userEmail.toLowerCase()},user_id.eq.${userId}`)
    .maybeSingle();

  return data || null;
}

/**
 * Accept an invite — mark it accepted and link user_id.
 */
async function acceptInvite(roomId, userEmail, userId) {
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) return;

  await serviceClient
    .from('room_share_invites')
    .update({ status: 'accepted', user_id: userId })
    .eq('room_id', roomId)
    .eq('email', userEmail.toLowerCase());
}

/**
 * Get all rooms shared with a user (via invite or link-join).
 * Returns rooms where user has an accepted invite.
 */
async function getSharedWithMe(userId, userEmail, accessToken) {
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) return [];

  const { data: invites } = await serviceClient
    .from('room_share_invites')
    .select('room_id, role, status, rooms(id, name, status, created_at, updated_at)')
    .or(`user_id.eq.${userId},email.eq.${userEmail.toLowerCase()}`)
    .in('status', ['pending', 'accepted']);

  if (!invites) return [];

  return invites
    .filter(i => i.rooms)
    .map(i => ({ ...i.rooms, shareRole: i.role, inviteStatus: i.status }));
}

module.exports = {
  getOrCreateShare,
  getShareSettings,
  updateShareSettings,
  addInvites,
  revokeInvite,
  validateShareToken,
  checkEmailInvite,
  acceptInvite,
  getSharedWithMe,
};

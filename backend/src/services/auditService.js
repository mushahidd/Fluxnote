const { getSupabaseClientForToken } = require('../utils/supabase');

async function logAuthEvent({
  accessToken,
  userId,
  eventType,
  ipAddress,
  userAgent,
  success,
  metadata,
}) {
  const client = getSupabaseClientForToken(accessToken);
  if (!client || !userId) return null;

  const payload = {
    user_id: userId,
    event_type: eventType,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    success: !!success,
    metadata: metadata || {},
  };

  const { data, error } = await client
    .from('auth_events')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

module.exports = {
  logAuthEvent,
};

const { getSupabaseClientForToken } = require('../utils/supabase');

async function syncUserProfile(user, accessToken) {
  const client = getSupabaseClientForToken(accessToken);
  if (!client || !user?.id) return null;

  const payload = {
    display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || '',
    avatar_url: user.user_metadata?.avatar_url || null,
    provider: user.app_metadata?.provider || user.user_metadata?.provider || null,
    provider_user_id: user.user_metadata?.sub || user.user_metadata?.provider_id || null,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('users')
    .update(payload)
    .eq('id', user.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

module.exports = {
  syncUserProfile,
};

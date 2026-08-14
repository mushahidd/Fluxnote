require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.RLS_CHECK_ACCESS_TOKEN;
const roomId = process.env.RLS_CHECK_ROOM_ID;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}
if (!accessToken) {
  console.error('Missing RLS_CHECK_ACCESS_TOKEN');
  process.exit(1);
}
if (!roomId) {
  console.error('Missing RLS_CHECK_ROOM_ID');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});

async function run() {
  console.log('RLS check starting...');

  const results = [];

  async function check(label, fn) {
    try {
      const data = await fn();
      results.push({ label, ok: true, data });
      console.log(`OK   ${label}`);
    } catch (error) {
      results.push({ label, ok: false, error: error.message });
      console.log(`FAIL ${label}: ${error.message}`);
    }
  }

  await check('rooms.select', async () => {
    const { data, error } = await client
      .from('rooms')
      .select('id, workspace_id, name')
      .eq('id', roomId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

  await check('room_shares.select', async () => {
    const { data, error } = await client
      .from('room_shares')
      .select('id, room_id, access_type, link_role')
      .eq('room_id', roomId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

  await check('room_shares.upsert', async () => {
    const { data, error } = await client
      .from('room_shares')
      .upsert({ room_id: roomId, access_type: 'restricted', link_role: 'viewer' }, { onConflict: 'room_id' })
      .select('id, room_id')
      .maybeSingle();
    if (error) throw error;
    return data;
  });

  let inviteId = null;
  await check('room_share_invites.insert', async () => {
    const { data, error } = await client
      .from('room_share_invites')
      .insert({ room_id: roomId, email: `rls-check-${Date.now()}@example.com`, role: 'viewer' })
      .select('id')
      .maybeSingle();
    if (error) throw error;
    inviteId = data?.id || null;
    return data;
  });

  if (inviteId) {
    await check('room_share_invites.delete', async () => {
      const { error } = await client
        .from('room_share_invites')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;
      return true;
    });
  }

  console.log('RLS check done.');
  return results;
}

run().catch((error) => {
  console.error('RLS check failed:', error);
  process.exitCode = 1;
});

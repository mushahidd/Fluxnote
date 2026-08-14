// Manual script to create a workspace for testing
// Run with: node create-workspace-manual.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createWorkspace() {
  console.log('Creating workspace...');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service Key (first 20 chars):', supabaseServiceKey?.substring(0, 20));

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get your user ID - replace with your actual user ID
  const userId = 'YOUR_USER_ID_HERE'; // You need to get this from Supabase auth.users table

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name: 'My Workspace',
      slug: 'my-workspace',
      owner_id: userId,
    })
    .select()
    .single();

  if (workspaceError) {
    console.error('Error creating workspace:', workspaceError);
    return;
  }

  console.log('Workspace created:', workspace);

  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
    })
    .select()
    .single();

  if (memberError) {
    console.error('Error adding member:', memberError);
    return;
  }

  console.log('Member added:', member);
  console.log('✅ Workspace setup complete!');
}

createWorkspace();

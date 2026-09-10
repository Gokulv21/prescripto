import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv() {
  const envFile = fs.readFileSync('.env', 'utf8');
  const env = {};
  envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
    }
  });
  return env;
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, user_id, full_name, role, is_superadmin, clinic_id');
  console.log('Profiles:', profiles);
  const { data: userRoles } = await supabase.from('user_roles').select('*');
  console.log('User Roles:', userRoles);
}

main();

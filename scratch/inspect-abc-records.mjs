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
  const abcId = '2385e763-dc58-476a-8847-67c4ec3ef4ad';
  const { data: patients } = await supabase.from('patients').select('*').eq('clinic_id', abcId);
  console.log('ABC Patients:', patients);
  const { data: visits } = await supabase.from('visits').select('*').eq('clinic_id', abcId);
  console.log('ABC Visits:', visits);
  const { data: rxs } = await supabase.from('prescriptions').select('*').eq('clinic_id', abcId);
  console.log('ABC Prescriptions:', rxs);
}

main();

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
  const { data: clinics, error } = await supabase.from('clinics').select('id, name, slug, owner_id');
  if (error) {
    console.error('Error fetching clinics:', error);
    return;
  }
  console.log('Clinics:', clinics);
  const abc = clinics.find(c => c.slug === 'abc');
  if (abc) {
    console.log('Found ABC clinic:', abc);
    const { count: pCount } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', abc.id);
    const { count: vCount } = await supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', abc.id);
    const { count: rxCount } = await supabase.from('prescriptions').select('*', { count: 'exact', head: true }).eq('clinic_id', abc.id);
    console.log(`ABC Clinic Stats -> Patients: ${pCount}, Visits: ${vCount}, Prescriptions: ${rxCount}`);
  } else {
    console.log('ABC clinic not found by slug abc');
  }
}

main();

/**
 * Prescripto Nova - Clinical & Operations Agent Tools Registry
 * Modular tool definitions for the Nova AI Bot by Zevox.
 * Extensible for future tools (e.g. appointment scheduling, pharmacy inventory).
 */

import { supabase } from '@/integrations/supabase/client';
import { buildPatientSearchFilter, rankPatientSearchResults } from '@/lib/patientSearch';
import { searchAppKnowledge, V14_FEATURES, APP_MODULES } from './appKnowledge';

export interface CandidatePatient {
  id: string;
  name: string;
  title?: string | null;
  age: number;
  sex: string;
  phone: string;
  registration_id?: string | null;
  reg_no?: number;
  last_opened_at?: string | null;
}

export interface PatientDetailedProfile {
  patient: CandidatePatient;
  totalVisits: number;
  lastVisit?: {
    date: string;
    token_number: number;
    status: string;
    vitals: {
      bp?: string | null;
      pulse?: number | null;
      temp?: number | null;
      spo2?: number | null;
      weight?: number | null;
      cbg?: number | null;
    };
    diagnosis?: string | null;
  } | null;
  recentPrescriptions: Array<{
    id: string;
    date: string;
    diagnosis?: string | null;
    clinical_notes?: string | null;
    medicinesSummary: string[];
    is_printed: boolean;
  }>;
}

/**
 * Tool 1: Search Patients with clinic-scoped data isolation
 */
export async function searchPatientsTool(clinicId?: string, query?: string): Promise<CandidatePatient[]> {
  if (!query || !query.trim()) return [];

  const cleanQuery = query.trim();
  let dbQuery = supabase
    .from('patients')
    .select('id, name, title, age, sex, phone, registration_id, reg_no, last_opened_at, created_at')
    .limit(10);

  if (clinicId) {
    dbQuery = dbQuery.eq('clinic_id', clinicId);
  }

  const filter = buildPatientSearchFilter(cleanQuery);
  if (filter) {
    dbQuery = dbQuery.or(filter);
  } else {
    dbQuery = dbQuery.ilike('name', `%${cleanQuery}%`);
  }

  const { data, error } = await dbQuery;
  if (error || !data) {
    console.error('[Nova Tools] Patient search error:', error);
    return [];
  }

  // Use Prescripto's ranking algorithm
  const ranked = rankPatientSearchResults(data as any[], cleanQuery);

  // Strictly filter out any patient whose name, phone, or registration ID does NOT actually match the query
  const qLower = cleanQuery.toLowerCase();
  const qWords = qLower.split(/\s+/).filter(w => w.length >= 2);
  const qDigits = qLower.replace(/\D/g, '');

  const strictlyMatched = ranked.filter(p => {
    const fullName = `${p.title ? p.title + ' ' : ''}${p.name || ''}`.toLowerCase();
    const phone = (p.phone || '').replace(/\D/g, '');
    const regId = (p.registration_id || '').toLowerCase();

    // 1. Direct query match on name, phone, or reg ID
    if (fullName.includes(qLower)) return true;
    if (qDigits.length >= 3 && phone.includes(qDigits)) return true;
    if (regId && regId.includes(qLower)) return true;

    // 2. Word-level match on name (e.g. first or last name)
    return qWords.some(w => w.length >= 3 && fullName.includes(w));
  });

  return strictlyMatched.slice(0, 5) as CandidatePatient[];
}

/**
 * Tool 2: Fetch detailed patient profile including past visits & prescriptions
 */
export async function getPatientFullProfileTool(patientId: string, clinicId?: string): Promise<PatientDetailedProfile | null> {
  if (!patientId) return null;

  let patientQuery = supabase
    .from('patients')
    .select('id, name, title, age, sex, phone, registration_id, reg_no, last_opened_at')
    .eq('id', patientId);

  if (clinicId) {
    patientQuery = patientQuery.eq('clinic_id', clinicId);
  }

  const { data: patientData, error: patientError } = await patientQuery.maybeSingle();
  if (patientError || !patientData) {
    console.error('[Nova Tools] Patient profile fetch error:', patientError);
    return null;
  }

  // Fetch recent visits
  const { data: visitsData } = await supabase
    .from('visits')
    .select('id, token_number, status, created_at, diagnosis, blood_pressure, pulse_rate, temperature, weight, spo2, cbg')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch recent prescriptions
  const { data: prescriptionsData } = await supabase
    .from('prescriptions')
    .select('id, diagnosis, clinical_notes, medicines, is_printed, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(3);

  const lastVisit = visitsData && visitsData.length > 0 ? {
    date: new Date(visitsData[0].created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }),
    token_number: visitsData[0].token_number,
    status: visitsData[0].status,
    vitals: {
      bp: visitsData[0].blood_pressure,
      pulse: visitsData[0].pulse_rate,
      temp: visitsData[0].temperature,
      spo2: visitsData[0].spo2,
      weight: visitsData[0].weight,
      cbg: visitsData[0].cbg
    },
    diagnosis: visitsData[0].diagnosis
  } : null;

  const recentPrescriptions = (prescriptionsData || []).map((rx: any) => {
    let meds: string[] = [];
    if (Array.isArray(rx.medicines)) {
      meds = rx.medicines.map((m: any) => {
        if (typeof m === 'string') return m;
        return `${m.name || m.medicine_name || 'Medicine'} ${m.dosage || m.frequency || ''}`.trim();
      }).filter(Boolean);
    }

    return {
      id: rx.id,
      date: new Date(rx.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      diagnosis: rx.diagnosis,
      clinical_notes: rx.clinical_notes,
      medicinesSummary: meds.slice(0, 5),
      is_printed: Boolean(rx.is_printed)
    };
  });

  return {
    patient: patientData as CandidatePatient,
    totalVisits: visitsData?.length || 0,
    lastVisit,
    recentPrescriptions
  };
}

/**
 * Tool 3: Get Live Clinic Analytics & Queue Statistics
 */
export interface ClinicLiveStats {
  clinicName?: string;
  totalPatients: number;
  todayVisits: {
    total: number;
    waiting: number;
    inCabin: number;
    completed: number;
  };
  yesterdayVisits: number;
  monthVisits: number;
  todayQueue: Array<{ token: number; patientName: string; status: string }>;
}

export async function getClinicLiveStatsTool(clinicId?: string): Promise<ClinicLiveStats> {
  const defaultStats: ClinicLiveStats = {
    totalPatients: 0,
    todayVisits: { total: 0, waiting: 0, inCabin: 0, completed: 0 },
    yesterdayVisits: 0,
    monthVisits: 0,
    todayQueue: []
  };

  if (!clinicId) return defaultStats;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
  const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999).toISOString();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    const [
      clinicRes,
      totalPtsRes,
      todayVisitsRes,
      yesterdayVisitsRes,
      monthVisitsRes,
      queueRes
    ] = await Promise.all([
      supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle(),
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('visits').select('status').eq('clinic_id', clinicId).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).gte('created_at', yesterdayStart).lte('created_at', yesterdayEnd),
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).gte('created_at', monthStart),
      supabase.from('visits')
        .select('token_number, status, patients(name)')
        .eq('clinic_id', clinicId)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .order('token_number', { ascending: true })
        .limit(10)
    ]);

    const todayList = todayVisitsRes.data || [];
    const waiting = todayList.filter(v => v.status === 'waiting').length;
    const inCabin = todayList.filter(v => v.status === 'in_consultation').length;
    const completed = todayList.filter(v => v.status === 'completed').length;

    const queue = (queueRes.data || []).map((q: any) => ({
      token: q.token_number,
      patientName: (q.patients as any)?.name || 'Patient',
      status: q.status
    }));

    return {
      clinicName: clinicRes.data?.name || 'Clinic',
      totalPatients: totalPtsRes.count || 0,
      todayVisits: {
        total: todayList.length,
        waiting,
        inCabin,
        completed
      },
      yesterdayVisits: yesterdayVisitsRes.count || 0,
      monthVisits: monthVisitsRes.count || 0,
      todayQueue: queue
    };
  } catch (err) {
    console.error('[Nova Tools] Failed to fetch live clinic stats:', err);
    return defaultStats;
  }
}

/**
 * Tool 4: Get App Navigation & Knowledge
 */
export async function getAppGuidanceTool(topicQuery: string) {
  return searchAppKnowledge(topicQuery);
}

/**
 * Tool specifications for LLM Function Calling (Gemini / OpenAI schema)
 */
export const NOVA_TOOL_DEFINITIONS = [
  {
    name: 'search_patients',
    description: 'Searches the clinic patient directory by name, phone number, or registration ID. Returns candidate patients.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search term (patient name, phone digits, or registration number)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_patient_details',
    description: 'Retrieves full medical summary, recent visits, vitals, and prescribed medications for a specific patient ID.',
    parameters: {
      type: 'object',
      properties: {
        patientId: {
          type: 'string',
          description: 'The unique UUID of the patient'
        }
      },
      required: ['patientId']
    }
  },
  {
    name: 'get_clinic_live_analytics',
    description: 'Fetches real-time clinic numbers: total patients, today visits count (waiting, in cabin, completed), yesterday visits count, and active queue tokens.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_app_guidance',
    description: 'Explains how to use Prescripto features, locates modules, and describes latest v1.4 updates.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The user question about Prescripto features or workflows'
        }
      },
      required: ['query']
    }
  }
];

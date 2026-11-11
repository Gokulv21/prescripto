/**
 * Prescripto Nova - Clinical & Operations Intelligence Service by Zevox
 * Handles user query dispatching, Gemini LLM reasoning, multilingual support (Tamil/Tanglish/English),
 * and intelligent tool execution.
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  searchPatientsTool, 
  getPatientFullProfileTool, 
  getClinicLiveStatsTool,
  CandidatePatient, 
  PatientDetailedProfile
} from './novaTools';

export interface NovaMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  patientCards?: CandidatePatient[];
  patientDetail?: PatientDetailedProfile;
  actionLink?: {
    label: string;
    path: string;
  };
}

export type CopilotMessage = NovaMessage; // backwards-compatible alias

export interface NovaContext {
  clinicId?: string;
  slug?: string;
  userRole?: string;
  doctorName?: string;
}

export type CopilotContext = NovaContext;

/**
 * Gets the optional local-dev Gemini API key from build environment (never user-entered)
 */
export function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('prescripto_gemini_api_key');
  }
  return (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
}

/**
 * Detects if the query is an Analytics / Statistics / Count / Volume inquiry
 */
function isAnalyticsIntent(input: string): boolean {
  const q = input.toLowerCase();
  return (
    q.includes('nethu') ||
    q.includes('yesterday') ||
    q.includes('ethana') ||
    q.includes('evlo') ||
    q.includes('how many') ||
    q.includes('count') ||
    q.includes('kanakku') ||
    q.includes('analytics') ||
    q.includes('report') ||
    q.includes('reports') ||
    q.includes('peak hour') ||
    q.includes('volume') ||
    q.includes('demographics') ||
    q.includes('retention') ||
    q.includes('queue status') ||
    q.includes('kootam') ||
    (q.includes('today') && (q.includes('visit') || q.includes('patient') || q.includes('queue') || q.includes('total') || q.includes('waiting'))) ||
    (q.includes('iniku') && (q.includes('visit') || q.includes('patient') || q.includes('queue') || q.includes('total') || q.includes('waiting'))) ||
    (q.includes('month') && (q.includes('visit') || q.includes('patient') || q.includes('total')))
  );
}

/**
 * Extracts clean patient search terms even from complex sentences
 * e.g., "give me the details for the patient ram" -> "ram"
 * e.g., "Hey enaku ram nu irukura patient oda details venum" -> "ram"
 * e.g., "patient john pathi sollu" -> "john"
 */
function extractPatientSearchTerm(input: string): string {
  let s = input.trim();

  // Strip all conversational filler & stop words in English and Tanglish
  const stopWords = /\b(sari|seri|ipo|eppo|appo|iruka|irukara|irukura|irukira|irukra|irukanga|irukangala|irukana|irukaaru|iruku|irukku|paaru|paatha|paathu|pathu|solla|sollu|solunga|slu|mudiyuma|theriyuma|aama|illai|kedaikuma|eduthu|kudu|kudunga|kaatu|katunga|vaanga|ponga|oru|dharava|iniku|nethu|naalaiku|ethana|evlo|yaaru|endha|edhu|give|me|please|fetch|get|show|display|find|search|check|open|who|is|tell|about|the|for|of|a|an|details|detail|record|records|history|vitals|profile|info|patient|patients|whose|name|named|hey|hi|hello|enaku|enakku|nu|oda|venum|pathi|pannu|inga|anga)\b/gi;
  s = s.replace(stopWords, ' ').replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Detects if the query is asking about a specific patient
 */
function isPatientLookupIntent(input: string): boolean {
  const q = input.toLowerCase().trim();

  // If asking about analytics or software/clinical features -> NEVER a patient search!
  if (isAnalyticsIntent(q)) return false;

  const isClinicalOrGeneralQuestion = (
    /\b(how to|what is|what are|why|when|treatment|medicine|tablet|syrup|dosage|dose|diet|fever|diabetes|diabetic|bp|hypertension|asthma|pain|allergy|infection|pregnant|symptom|side effect|guide|steps|explain|difference|meaning|epdi|yen|enna panrathu|enna medicine)\b/i.test(q)
  );

  // Explicit lookup phrases
  const isExplicitPatientCommand = (
    /^(find|search|lookup|open|show|fetch|get)\s+(patient|record|details)\b/i.test(q) ||
    /\b(search patient|find patient|lookup patient|patient details|patient record|patient profile|patient history|details for patient|details of patient|give me the details for the patient|patient pathi|patient oda)\b/i.test(q) ||
    /\b(mr\.|mrs\.|miss\.|mast\.|baby)\s+[a-z]{2,}/i.test(q)
  );

  if (!isExplicitPatientCommand) {
    return false;
  }

  // If it clearly asks a medical/operational question like "how to delete patient history", let AI answer
  if (isClinicalOrGeneralQuestion && !/^(find|search|lookup)\s+patient\b/i.test(q)) {
    return false;
  }

  return true;
}

/**
 * Checks if the user prefers Tamil / Tanglish
 */
function isTamilRequested(input: string): boolean {
  const q = input.toLowerCase();
  return (
    q.includes('tamil') ||
    q.includes('தமிழ்') ||
    q.includes('enaku') ||
    q.includes('enakku') ||
    q.includes('indha') ||
    q.includes('andha') ||
    q.includes('enna') ||
    q.includes('sollu') ||
    q.includes('solla') ||
    q.includes('solunga') ||
    q.includes('slu') ||
    q.includes('pannu') ||
    q.includes('panradhu') ||
    q.includes('pannunga') ||
    q.includes('venum') ||
    q.includes('vendam') ||
    q.includes('epdi') ||
    q.includes('engae') ||
    q.includes('enga') ||
    q.includes('kaatu') ||
    q.includes('katunga') ||
    q.includes('pathi') ||
    q.includes('pudhu') ||
    q.includes('pudhusa') ||
    q.includes('irukanga') ||
    q.includes('irukura') ||
    q.includes('irukira') ||
    q.includes('iruku') ||
    q.includes('irukku') ||
    q.includes('kudu') ||
    q.includes('kudunga') ||
    q.includes('puriyala') ||
    q.includes('theriyala') ||
    /[\u0B80-\u0BFF]/.test(input)
  );
}

interface GeminiResult {
  text: string | null;
  error?: string;
}

/**
 * Extracts text parts cleanly from Gemini response (skipping internal thinking parts on 2.5 models)
 */
function extractGeminiText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p: any) => !p?.thought && typeof p?.text === 'string')
    .map((p: any) => p.text)
    .join('')
    .trim();
}

/**
 * Builds valid alternating Gemini conversation turns starting strictly with a 'user' turn.
 */
function buildGeminiContents(history: NovaMessage[], userPrompt: string) {
  const cleanHistory = history
    .filter(m => m && m.text && !m.id?.startsWith('init-') && !m.id?.startsWith('err-'))
    .slice(-8)
    .map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text.trim()
    }));

  // Drop leading 'model' turns so contents[0] is always 'user' (required by Gemini API)
  while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
    cleanHistory.shift();
  }

  // Ensure strict alternating user / model roles
  const turns: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const item of cleanHistory) {
    if (turns.length > 0 && turns[turns.length - 1].role === item.role) {
      turns[turns.length - 1].parts[0].text += `\n${item.text}`;
    } else {
      turns.push({ role: item.role as 'user' | 'model', parts: [{ text: item.text }] });
    }
  }

  if (turns.length > 0 && turns[turns.length - 1].role === 'user') {
    turns[turns.length - 1].parts[0].text += `\n${userPrompt}`;
  } else {
    turns.push({ role: 'user', parts: [{ text: userPrompt }] });
  }

  return turns;
}

/**
 * Calls Gemini via REST API with multi-model fallback and strict timeout
 */
async function callGeminiAI(
  apiKey: string,
  userPrompt: string,
  systemInstructions: string,
  history: NovaMessage[] = []
): Promise<GeminiResult> {
  // Active Google Gemini models ordered from fastest/newest to latest aliases
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
  ];

  const contents = buildGeminiContents(history, userPrompt);
  const errors: string[] = [];

  const tryModel = async (model: string): Promise<{ text?: string; authFatal?: boolean }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstructions }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
        })
      });
      clearTimeout(timer);

      if (!response.ok && response.status === 400) {
        const fbController = new AbortController();
        const fbTimer = setTimeout(() => fbController.abort(), 12000);
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: fbController.signal,
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${systemInstructions}\n\n[USER QUERY]\n${userPrompt}` }]
              }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
            })
          });
        } finally {
          clearTimeout(fbTimer);
        }
      }

      if (response.ok) {
        const data = await response.json();
        const text = extractGeminiText(data);
        if (text) return { text };
        const reason = data?.candidates?.[0]?.finishReason || 'NO_TEXT';
        errors.push(`${model}: Empty response (${reason})`);
        return {};
      }

      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
      errors.push(`${model}: ${errMsg}`);
      return { authFatal: response.status === 401 || response.status === 403 || errMsg.toLowerCase().includes('api key') };
    } catch (err: any) {
      clearTimeout(timer);
      errors.push(`${model}: ${err?.message || 'Network timeout'}`);
      return {};
    }
  };

  const tried = new Set<string>();
  let authFatal = false;
  for (const model of candidateModels) {
    tried.add(model);
    const res = await tryModel(model);
    if (res.text) return { text: res.text };
    if (res.authFatal) {
      authFatal = true;
      break;
    }
  }

  if (!authFatal) {
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`);
      if (listRes.ok) {
        const listJson = await listRes.json();
        const discovered: string[] = (listJson?.models || [])
          .filter((m: any) =>
            Array.isArray(m?.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            typeof m?.name === 'string' &&
            m.name.includes('gemini-') &&
            !/(embedding|imagen|veo|tts|audio|live|robotics|computer-use|image-generation|aqa|1\.5|2\.0)/i.test(m.name)
          )
          .map((m: any) => String(m.name).replace(/^models\//, ''))
          .filter((id: string) => !tried.has(id))
          .sort((a: string, b: string) => {
            const score = (id: string) =>
              (id.includes('flash') ? 10 : 0) +
              (id.includes('lite') ? 4 : 0) +
              (id.includes('latest') ? 3 : 0) -
              (id.includes('pro') ? 2 : 0);
            return score(b) - score(a);
          })
          .slice(0, 4);

        for (const model of discovered) {
          const res = await tryModel(model);
          if (res.text) return { text: res.text };
        }
      }
    } catch {
      // ignore discovery failure
    }
  }

  return { text: null, error: errors.slice(0, 3).join(' | ') || 'Unable to reach Gemini AI service' };
}

// Security Guardrails: Client-side query rate limiter to prevent budget drain & spam
const recentQueryTimestamps: number[] = [];
const MAX_QUERIES_PER_MINUTE = 15;
const MAX_QUERY_LENGTH = 2000;

function inferPreScriptoActionLink(
  query: string,
  canViewClinicAnalytics: boolean,
  prefersTamil: boolean,
  prefixPath: (p: string) => string
): { label: string; path: string } | undefined {
  const q = query.toLowerCase();
  const isPrescriptoIntent = /\b(prescripto|clinic|staff|team|password|role|letterhead|theme|color|print queue|tv display|token|nurse|patient entry|triage|analytics|consultation desk|patients list|directory)\b/.test(q);
  if (!isPrescriptoIntent) return undefined;

  if (/\b(user|users|password|staff|team|role)\b/.test(q)) {
    return { label: prefersTamil ? 'பணியாளர் மேலாண்மை' : 'Open Team Management', path: prefixPath('/users') };
  }
  if (/\b(setting|theme|appearance|color|letterhead|logo)\b/.test(q)) {
    return { label: prefersTamil ? 'அமைப்புகள் பக்கம்' : 'Open Clinic Settings', path: prefixPath('/settings') };
  }
  if (canViewClinicAnalytics && /\b(analytic|analytics|nethu|yesterday|report|retention|demographics)\b/.test(q)) {
    return { label: prefersTamil ? 'அனலிட்டிக்ஸ் பக்கம்' : 'Open Analytics Page', path: prefixPath('/analytics') };
  }
  if (/\b(print queue|thermal|reprint)\b/.test(q)) {
    return { label: prefersTamil ? 'பிரிண்ட் வரிசைக்கு செல்' : 'Open Print Queue', path: prefixPath('/print') };
  }
  if (/\b(tv display|token display|waiting room)\b/.test(q)) {
    return { label: prefersTamil ? 'டிவி காட்சியை திற' : 'Open TV Display', path: prefixPath('/display') };
  }
  if (/\b(consultation desk|patient entry|triage)\b/.test(q)) {
    return q.includes('entry') || q.includes('triage')
      ? { label: prefersTamil ? 'நோயாளி பதிவுக்கு செல்' : 'Go to Patient Entry', path: prefixPath('/nurse') }
      : { label: prefersTamil ? 'ஆலோசனைக்கு செல்' : 'Go to Consultation', path: prefixPath('/consultation') };
  }
  return undefined;
}

/**
 * Main function to process incoming staff/doctor queries
 */
export async function sendNovaMessage(
  userText: string,
  context: NovaContext,
  history: NovaMessage[] = []
): Promise<NovaMessage> {
  const query = userText.trim();
  const clinicId = context.clinicId;
  const slug = context.slug;
  const apiKey = getGeminiApiKey();
  const prefersTamil = isTamilRequested(query);

  const prefixPath = (p: string) => {
    if (!slug || p.startsWith(`/${slug}`)) return p;
    return `/${slug}${p === '/' ? '/dashboard' : p}`;
  };

  // 0. Security Guardrail: Input length cap (prevent token exhaustion & massive payload abuse)
  if (query.length > MAX_QUERY_LENGTH) {
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: prefersTamil
        ? 'கேள்வி மிகவும் நீளமாக உள்ளது (அதிகபட்சம் 2000 எழுத்துக்கள்). தயவுசெய்து சுருக்கமாக கேட்கவும்.'
        : 'Query exceeds the maximum allowed limit of 2000 characters. Please provide a concise question.',
      timestamp: new Date()
    };
  }

  // 0. Security Guardrail: Rate limiter (prevent abuse & API budget draining)
  const now = Date.now();
  while (recentQueryTimestamps.length > 0 && recentQueryTimestamps[0] < now - 60000) {
    recentQueryTimestamps.shift();
  }
  if (recentQueryTimestamps.length >= MAX_QUERIES_PER_MINUTE) {
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: prefersTamil
        ? 'வினாக்கள் மிக வேகமாக கேட்கப்படுகின்றன (Rate limit). தயவுசெய்து ஒரு நிமிடம் கழித்து முயற்சிக்கவும்.'
        : 'Rate limit notice: Please wait a moment before sending more queries to protect clinic AI resources.',
      timestamp: new Date()
    };
  }
  recentQueryTimestamps.push(now);

  // Fire-and-forget query logging for audit trail & analytics
  if (query && query.length >= 2) {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        await supabase.from('nova_queries').insert({
          clinic_id: clinicId || null,
          user_id: data?.user?.id || null,
          user_name: context.doctorName || 'Staff Member',
          user_role: context.userRole || 'staff',
          query: query
        });
      } catch (err) {
        // silent fail
      }
    })();
  }

  // 1. Fetch real-time live clinic statistics (visits, yesterday, queue, totals)
  const liveStats = await getClinicLiveStatsTool(clinicId);

  // 2. Check for Specific Patient Lookup Intent (strictly when NOT an analytics query)
  if (isPatientLookupIntent(query) && !isAnalyticsIntent(query)) {
    const searchTerm = extractPatientSearchTerm(query);
    if (searchTerm && searchTerm.length >= 2) {
      const matches = await searchPatientsTool(clinicId, searchTerm);

      if (matches.length === 1) {
        const profile = await getPatientFullProfileTool(matches[0].id, clinicId);
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: prefersTamil
            ? `**${matches[0].name}** க்கான மருத்துவ விவரங்கள்:`
            : `Found 1 exact match for **${matches[0].name}**. Here is the clinical summary:`,
          timestamp: new Date(),
          patientDetail: profile || undefined,
          actionLink: {
            label: prefersTamil ? 'ஆலோசனை மேஜையை திற' : 'Open Consultation Desk',
            path: prefixPath('/consultation')
          }
        };
      }

      if (matches.length > 1) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: prefersTamil
            ? `**"${searchTerm}"** என்ற பெயரில் **${matches.length} நோயாளிகள்** கண்டறியப்பட்டுள்ளனர். தேவையான நபரை தேர்ந்தெடுக்கவும்:`
            : `Found **${matches.length} patients** matching **"${searchTerm}"**. Please select the matching patient below:`,
          timestamp: new Date(),
          patientCards: matches
        };
      }

      // If explicit "search patient ..." / "find patient ..." returned 0 matches, tell the user;
      // otherwise let Gemini AI answer directly!
      const isExplicitSearch = /^(find|search|lookup)\s+patient\b/i.test(query.trim());
      if (isExplicitSearch) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: prefersTamil
            ? `உங்கள் கிளினிக்கில் **"${searchTerm}"** என்ற பெயரில் எந்த நோயாளியும் கிடைக்கவில்லை. எழுத்துப் பிழையை சரிபார்க்கவும் அல்லது நோயாளிகள் பட்டியலில் தேடவும்.`
            : `No patient records found matching **"${searchTerm}"** in this clinic. Please verify spelling or search by registration ID.`,
          timestamp: new Date(),
          actionLink: {
            label: prefersTamil ? 'நோயாளிகள் பட்டியலை திற' : 'Open Patients Directory',
            path: prefixPath('/patients')
          }
        };
      }
    }
  }

  const canViewClinicAnalytics = context.userRole === 'owner' || context.userRole === 'superadmin';
  const clinicContextText = canViewClinicAnalytics ? `
CLINIC LIVE CONTEXT:
Clinic Name: ${liveStats.clinicName || 'Clinic'}
Total Registered Patients: ${liveStats.totalPatients}
Today's Visits: ${liveStats.todayVisits.total} (Waiting: ${liveStats.todayVisits.waiting}, In Cabin: ${liveStats.todayVisits.inCabin}, Completed: ${liveStats.todayVisits.completed})
Yesterday's Visits: ${liveStats.yesterdayVisits}
This Month's Total Visits: ${liveStats.monthVisits}
Today's Active Queue:
${liveStats.todayQueue.length > 0 ? liveStats.todayQueue.map(q => `- Token #${q.token}: ${q.patientName} (${q.status})`).join('\n') : 'No active queue currently.'}

PRESCRIPTO APP MODULES & URLS:
- /dashboard : Command Center, live queue flow, completion rate, quick patient registration.
- /analytics : Clinical & operational BI (Patient Volume Dynamics, Peak Consultation Hours, Diagnosis Distribution, Demographics, Patient Retention, Protocol Analytics).
- /nurse : Patient Entry & vitals triage (BP, pulse, temp, spo2, weight, cbg).
- /consultation : Doctor clinical desk, past history, digital prescriptions (typed or stylus drawing).
- /print : Centralized thermal & A4 prescription print queue.
- /display : Waiting room TV queue token display with audio chime.
- /patients : Patients directory archive and timeline history.
- /users : Staff & doctor role management.
- /profile : Clinic branding, letterhead, fees, and signatures.
- /about : System details and v1.5 changelog.
` : `
CLINIC LIVE CONTEXT:
Clinic Name: ${liveStats.clinicName || 'Clinic'}
Today's Active Queue:
${liveStats.todayQueue.length > 0 ? liveStats.todayQueue.map(q => `- Token #${q.token}: ${q.patientName} (${q.status})`).join('\n') : 'No active queue currently.'}

PRESCRIPTO APP MODULES & URLS:
- /dashboard : Command Center, live queue flow, quick patient registration.
- /nurse : Patient Entry & vitals triage (BP, pulse, temp, spo2, weight, cbg).
- /consultation : Doctor clinical desk, past history, digital prescriptions (typed or stylus drawing).
- /print : Centralized thermal & A4 prescription print queue.
- /display : Waiting room TV queue token display with audio chime.
- /patients : Patients directory archive and timeline history.
- /profile : Personal doctor stats, digital signature, qualifications, and protocols.
- /about : System details and v1.5 changelog.
`;

  // 4. Route every query through Google Gemini (Edge Function or optional local dev key)
  let geminiFailureReason = '';
  const systemPrompt = `You are Google Gemini acting as "Nova", a helpful clinical, medical, and clinic-operations AI assistant for PreScripto.

PRIMARY INSTRUCTIONS:
- Answer the user's actual question directly, accurately, and naturally — just as Google Gemini would answer it.
- Answer ANY topic clearly: medicine, pharmacology, differential diagnosis, dosing, general knowledge, coding, everyday topics, or Tamil/Tanglish/English conversation.
- NEVER inject unrelated PreScripto UI steps, boilerplate, or navigation instructions unless the user specifically asked about PreScripto software or their clinic/patients.
- Do NOT open with scripted self-introductions (do NOT say "I am Nova by Zevox").
- Match the user's language naturally (Tamil script, Tanglish, or English).
- Use the PreScripto clinic context below ONLY when relevant to a clinic/patient/software question:

${clinicContextText}`;

  if (apiKey) {
    const aiResult = await callGeminiAI(apiKey, query, systemPrompt, history);
    if (aiResult.text) {
      let actionLink: { label: string; path: string } | undefined = inferPreScriptoActionLink(query, canViewClinicAnalytics, prefersTamil, prefixPath);
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: aiResult.text,
        timestamp: new Date(),
        actionLink
      };
    }

      if (false) {
      } else if (canViewClinicAnalytics && (lowerAi.includes('analytics') || lowerQuery.includes('analytic') || lowerQuery.includes('nethu') || lowerQuery.includes('yesterday') || lowerQuery.includes('report'))) {
        actionLink = { label: prefersTamil ? 'அனலிட்டிக்ஸ் பக்கம்' : 'Open Analytics Page', path: prefixPath('/analytics') };
      } else if (lowerAi.includes('print') || lowerQuery.includes('print')) {
        actionLink = { label: prefersTamil ? 'பிரிண்ட் வரிசைக்கு செல்' : 'Open Print Queue', path: prefixPath('/print') };
      } else if (lowerAi.includes('tv') || lowerQuery.includes('tv') || lowerAi.includes('display')) {
        actionLink = { label: prefersTamil ? 'டிவி காட்சியை திற' : 'Open TV Display', path: prefixPath('/display') };
      }

    geminiFailureReason = aiResult.error || 'Gemini AI request failed';
  }

  // Try Supabase Edge Function 'prescripto-nova' (production path with server-side GEMINI_API_KEY)
  try {
    const cleanHistory = history
      .filter(m => m && m.text && !m.id?.startsWith('init-') && !m.id?.startsWith('err-'))
      .slice(-8)
      .map(m => ({ sender: m.sender, text: m.text.slice(0, 1000) }));

    const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('prescripto-nova', {
      body: {
        message: query,
        clinicId: clinicId,
        userRole: context.userRole || 'doctor',
        clinicContext: clinicContextText,
        history: cleanHistory
      }
    });

    if (!edgeErr && edgeRes?.text && !edgeRes?.fallback) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: edgeRes.text,
        timestamp: new Date(),
        patientCards: edgeRes.patientCards,
        actionLink: inferPreScriptoActionLink(query, canViewClinicAnalytics, prefersTamil, prefixPath)
      };
    }

    if (edgeRes?.geminiError || edgeRes?.error) {
      geminiFailureReason = edgeRes.geminiError || edgeRes.error;
    } else if (edgeErr) {
      let detail = edgeErr.message || 'Edge Function request failed';
      try {
        const ctxBody = await (edgeErr as any).context?.json?.();
        if (ctxBody?.error) detail = ctxBody.error;
      } catch {
        // ignore JSON parse errors
      }
      geminiFailureReason = detail;
    }
  } catch (edgeCallErr: any) {
    geminiFailureReason = edgeCallErr?.message || 'Unable to reach Nova AI service';
    console.warn('Edge function nova fallback notice:', edgeCallErr);
  }

  // 5. Offline / API Outage Fallback (ONLY when Gemini did not respond)
  if (isAnalyticsIntent(query)) {
    if (!canViewClinicAnalytics) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: prefersTamil
          ? 'கிளினிக் அளவிலான அனலிட்டிக்ஸ் மற்றும் வணிகப் புள்ளிவிவரங்கள் கிளினிக் உரிமையாளருக்கு (Clinic Owner) மட்டுமே அனுமதிக்கப்பட்டுள்ளது. உங்கள் சொந்த நோயாளி புள்ளிவிவரங்களை **Profile** பக்கத்தில் காணலாம்.'
          : 'Clinic-wide business analytics are restricted to the Clinic Owner. You can view your own treated patient stats and demographics in your **Profile** page.',
        timestamp: new Date(),
        actionLink: {
          label: prefersTamil ? 'சுயவிவரத்தை திற' : 'Open My Profile',
          path: prefixPath('/profile')
        }
      };
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: prefersTamil
        ? `உங்கள் கிளினிக்கின் (**${liveStats.clinicName || 'Clinic'}**) தற்போதைய புள்ளிவிவரங்கள்:\n\n• **நேற்று வருகை புரிந்த நோயாளிகள்:** ${liveStats.yesterdayVisits}\n• **இன்றைய வருகைகள்:** ${liveStats.todayVisits.total} (காத்திருப்போர்: ${liveStats.todayVisits.waiting}, ஆலோசனையில்: ${liveStats.todayVisits.inCabin}, முடிந்தது: ${liveStats.todayVisits.completed})\n• **மொத்த பதிவு செய்யப்பட்ட நோயாளிகள்:** ${liveStats.totalPatients}\n• **இந்த மாத மொத்த வருகைகள்:** ${liveStats.monthVisits}`
        : `Live operational summary for **${liveStats.clinicName || 'Clinic'}**:\n\n• **Yesterday's visits:** ${liveStats.yesterdayVisits}\n• **Today's visits:** ${liveStats.todayVisits.total} (${liveStats.todayVisits.waiting} waiting, ${liveStats.todayVisits.inCabin} in cabin, ${liveStats.todayVisits.completed} completed)\n• **Total registered patients:** ${liveStats.totalPatients}\n• **Month-to-date visits:** ${liveStats.monthVisits}`,
      timestamp: new Date(),
      actionLink: {
        label: prefersTamil ? 'அனலிட்டிக்ஸ் திறக்க' : 'Open Analytics Page',
        path: prefixPath('/analytics')
      }
    };
  }

  const reasonText = geminiFailureReason || 'Gemini AI service temporarily unreachable.';
  return {
    id: `err-${Date.now()}`,
    sender: 'assistant',
    text: prefersTamil
      ? `⚠️ **Gemini AI பதில் பெற முடியவில்லை:**\n\`${reasonText}\`\n\nதயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.`
      : `⚠️ **Gemini AI could not respond right now:**\n\`${reasonText}\`\n\nPlease verify the server \`GEMINI_API_KEY\` secret in Supabase Edge Functions and try again.`,
    timestamp: new Date()
  };
}

// Backwards-compatible alias
export const sendCopilotMessage = sendNovaMessage;

/**
 * Handles selecting a specific patient from the candidate list
 */
export async function selectPatientProfile(
  patientId: string, 
  clinicId?: string, 
  slug?: string
): Promise<NovaMessage> {
  const profile = await getPatientFullProfileTool(patientId, clinicId);
  if (!profile) {
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: 'Unable to load patient records. The record may belong to another clinic or has been modified.',
      timestamp: new Date()
    };
  }

  const p = profile.patient;
  const fullName = `${p.title ? p.title + ' ' : ''}${p.name}`;

  return {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    text: `Clinical summary for **${fullName}** (${p.age}y / ${p.sex}):`,
    timestamp: new Date(),
    patientDetail: profile,
    actionLink: {
      label: 'Open Consultation Desk',
      path: slug ? `/${slug}/consultation` : '/consultation'
    }
  };
}

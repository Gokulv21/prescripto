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
  PatientDetailedProfile,
  ClinicLiveStats
} from './novaTools';
import { searchAppKnowledge, V14_FEATURES, APP_MODULES } from './appKnowledge';

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
 * Gets the active Gemini API key from environment or local storage
 */
export function getGeminiApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    localStorage.getItem('prescripto_gemini_api_key') ||
    ''
  ).trim();
}

/**
 * Saves a custom Gemini API key to local storage
 */
export function setGeminiApiKey(key: string): void {
  if (key) {
    localStorage.setItem('prescripto_gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('prescripto_gemini_api_key');
  }
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
  const q = input.toLowerCase();

  // If asking about analytics or software features -> NEVER a patient search!
  if (isAnalyticsIntent(q)) return false;

  const isSoftwareTopic = (
    q.includes('feature') ||
    q.includes('pudhu') ||
    q.includes('v1.4') ||
    q.includes('update') ||
    q.includes('changelog') ||
    q.includes('how to') ||
    q.includes('epdi') ||
    q.includes('chime') ||
    q.includes('bell') ||
    q.includes('sound') ||
    q.includes('print queue') ||
    q.includes('tv display') ||
    q.includes('dock') ||
    q.includes('launcher') ||
    q.includes('prescription guide') ||
    q.includes('explain')
  );

  if (isSoftwareTopic && !q.includes('patient') && !q.includes('நோயாளி')) {
    return false;
  }

  // Must have clear patient indicator
  return (
    q.includes('patient') ||
    q.includes('நோயாளி') ||
    q.includes('whose name is') ||
    q.includes('patient pathi') ||
    q.includes('patient details') ||
    q.includes('details for') ||
    q.includes('details of') ||
    /\b(mr\.|mrs\.|miss\.|dr\.|master\.|baby\.)\s+[a-z]+/i.test(q) ||
    q.startsWith('find patient') ||
    q.startsWith('search patient') ||
    q.startsWith('give me the details for the patient')
  );
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

/**
 * Calls Gemini via REST API with multi-model fallback and strict timeout
 */
async function callGeminiAI(
  apiKey: string,
  userPrompt: string,
  systemInstructions: string,
  history: NovaMessage[] = []
): Promise<string | null> {
  // Official active Google Gemini models with fallback
  const candidateModels = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro'
  ];

  const formattedHistory = history.slice(-6).map(m => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }]
  }));

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstructions }]
          },
          contents: [
            ...formattedHistory,
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 800,
          }
        })
      });

      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        console.warn(`[Nova AI] ${model} returned ${response.status}:`, errJson);

        // Fallback for models or API keys that don't support systemInstruction field directly
        if (response.status === 400) {
          const fallbackController = new AbortController();
          const fallbackTimer = setTimeout(() => fallbackController.abort(), 8000);
          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: fallbackController.signal,
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${systemInstructions}\n\n[USER QUERY]\n${userPrompt}` }]
                  }
                ],
                generationConfig: {
                  temperature: 0.35,
                  maxOutputTokens: 800,
                }
              })
            });
            clearTimeout(fallbackTimer);
            if (fallbackRes.ok) {
              const fbData = await fallbackRes.json();
              const fbText = fbData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (fbText) return fbText;
            }
          } catch {
            clearTimeout(fallbackTimer);
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timer);
      console.warn(`[Nova AI] Model ${model} request failed or timed out:`, err?.message || err);
    }
  }

  return null;
}

// Security Guardrails: Client-side query rate limiter to prevent budget drain & spam
const recentQueryTimestamps: number[] = [];
const MAX_QUERIES_PER_MINUTE = 15;
const MAX_QUERY_LENGTH = 500;

/**
 * Main function to process incoming staff/doctor queries
 */
export async function sendNovaMessage(
  userText: string,
  context: NovaContext,
  history: NovaMessage[] = []
): Promise<NovaMessage> {
  const query = userText.trim();
  const lowerQuery = query.toLowerCase();
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
        ? 'கேள்வி மிகவும் நீளமாக உள்ளது (அதிகபட்சம் 500 எழுத்துக்கள்). தயவுசெய்து சுருக்கமாக கேட்கவும்.'
        : 'Query exceeds the maximum allowed limit of 500 characters. Please provide a concise question.',
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
    if (!searchTerm || searchTerm.length < 2) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: prefersTamil
          ? 'தயவுசெய்து நோயாளியின் பெயர், தொலைபேசி எண் அல்லது பதிவு எண்ணை குறிப்பிடவும் (உதா: "Search patient Ram").'
          : 'Please specify the patient name, phone number, or registration ID to search (e.g., "Search patient Ram").',
        timestamp: new Date()
      };
    }

    const matches = await searchPatientsTool(clinicId, searchTerm);

    if (matches.length === 0) {
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

  // 3. Build Real-time Operational Context for Gemini AI Reasoning
  const clinicContextText = `
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
- /about : System details and v1.4 changelog.
`;

  // 4. If Gemini API Key is configured, use Real AI LLM Reasoning with Live Data
  if (apiKey) {
    const systemPrompt = `You are "Nova", the intelligent clinical & operations AI created by Zevox.
You power PreScripto (a flagship healthcare product by Zevox for modern hospitals and healthcare providers).

${clinicContextText}

PRIMARY INSTRUCTIONS:
- Directly answer the user's question without repetitive introductory boilerplate (do NOT start with "I am Nova by Zevox").
- MULTILINGUAL MASTERY:
  * If the user writes in Tamil or Tanglish (e.g. "staff password marandhuta enna panradhu", "tamil la sollu", "enaku nethu ethana patients vandhanga"): Respond fluently, warmly, and naturally in Tamil (தமிழ்) or conversational Tanglish matching their tone!
  * If the user writes in English: Respond in clean, professional, structured English.
- OPERATIONAL & CLINIC MANAGEMENT QUESTIONS:
  * If asked about staff forgot password / password reset: Explain that the Clinic Owner can reset or re-create credentials from /users, or staff can use the Forgot Password link on the login screen.
  * If asked about user roles, adding doctors/staff, or access control: Explain Owner vs Doctor vs Staff permissions at /users.
  * If asked about clinic branding, letterhead, phone, address, or fees: Refer them to /settings and /profile.
  * If asked about appearance, colors, or dark mode: Explain per-device themes and custom hex color picker at /settings.
  * If asked about patient entry, vitals, queues, printing, or TV display: Give concrete operational steps and recommend the right path (/nurse, /consultation, /print, /display, /analytics).
- CLINICAL & MEDICAL QUESTIONS:
  * Answer with clinical accuracy, standard dosages, triage red flags, and precautions.
- FORMATTING:
  * Use bold headers, bullet lists, and markdown tables when comparing or presenting structured data.`;

    const aiResponse = await callGeminiAI(apiKey, query, systemPrompt, history);
    if (aiResponse) {
      let actionLink: { label: string; path: string } | undefined;
      const lowerAi = aiResponse.toLowerCase();

      if (lowerAi.includes('user') || lowerAi.includes('password') || lowerAi.includes('staff') || lowerQuery.includes('user') || lowerQuery.includes('password') || lowerQuery.includes('staff') || lowerQuery.includes('doctor') || lowerQuery.includes('role')) {
        actionLink = { label: prefersTamil ? 'பணியாளர் மேலாண்மை' : 'Open Team Management', path: prefixPath('/users') };
      } else if (lowerAi.includes('setting') || lowerAi.includes('theme') || lowerAi.includes('appearance') || lowerAi.includes('color') || lowerQuery.includes('setting') || lowerQuery.includes('theme') || lowerQuery.includes('appearance') || lowerQuery.includes('color')) {
        actionLink = { label: prefersTamil ? 'அமைப்புகள் பக்கம்' : 'Open Clinic Settings', path: prefixPath('/settings') };
      } else if (lowerAi.includes('analytics') || lowerQuery.includes('analytic') || lowerQuery.includes('nethu') || lowerQuery.includes('yesterday') || lowerQuery.includes('report')) {
        actionLink = { label: prefersTamil ? 'அனலிட்டிக்ஸ் பக்கம்' : 'Open Analytics Page', path: prefixPath('/analytics') };
      } else if (lowerAi.includes('print') || lowerQuery.includes('print')) {
        actionLink = { label: prefersTamil ? 'பிரிண்ட் வரிசைக்கு செல்' : 'Open Print Queue', path: prefixPath('/print') };
      } else if (lowerAi.includes('tv') || lowerQuery.includes('tv') || lowerAi.includes('display')) {
        actionLink = { label: prefersTamil ? 'டிவி காட்சியை திற' : 'Open TV Display', path: prefixPath('/display') };
      } else if (lowerAi.includes('consultation') || lowerQuery.includes('consult')) {
        actionLink = { label: prefersTamil ? 'ஆலோசனைக்கு செல்' : 'Go to Consultation', path: prefixPath('/consultation') };
      } else if (lowerAi.includes('nurse') || lowerQuery.includes('patient entry') || lowerQuery.includes('register') || lowerQuery.includes('vital')) {
        actionLink = { label: prefersTamil ? 'நோயாளி பதிவுக்கு செல்' : 'Go to Patient Entry', path: prefixPath('/nurse') };
      }

      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: aiResponse,
        timestamp: new Date(),
        actionLink
      };
    }
  } else {
    // Try calling Supabase Edge Function 'prescripto-nova' (server-side Gemini with zero client secrets)
    try {
      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('prescripto-nova', {
        body: {
          message: query,
          clinicId: clinicId,
          userRole: context.userRole || 'doctor'
        }
      });
      if (!edgeErr && edgeRes?.text) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: edgeRes.text,
          timestamp: new Date(),
          patientCards: edgeRes.patientCards
        };
      }
    } catch (edgeCallErr) {
      console.warn('Edge function nova fallback notice:', edgeCallErr);
    }
  }

  // 5. Fallback: Intelligent Deterministic Analytics Engine (Offline / API failure)
  if (isAnalyticsIntent(query)) {
    if (prefersTamil) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `உங்கள் கிளினிக்கின் (**${liveStats.clinicName || 'Clinic'}**) தற்போதைய புள்ளிவிவரங்கள்:\n\n• **நேற்று வருகை புரிந்த நோயாளிகள்:** ${liveStats.yesterdayVisits}\n• **இன்றைய வருகைகள்:** ${liveStats.todayVisits.total} (காத்திருப்போர்: ${liveStats.todayVisits.waiting}, ஆலோசனையில்: ${liveStats.todayVisits.inCabin}, முடிந்தது: ${liveStats.todayVisits.completed})\n• **மொத்த பதிவு செய்யப்பட்ட நோயாளிகள்:** ${liveStats.totalPatients}\n• **இந்த மாத மொத்த வருகைகள்:** ${liveStats.monthVisits}\n\nதினசரி மற்றும் மாதாந்திர நோயாளி வருகை வரைபடம் (Volume Dynamics), அதிக തിരக்குள்ள நேரங்கள் (Peak Hours) மற்றும் நோயறிதல் பகுப்பாய்வை (Diagnosis Trends) காண கீழே உள்ள அனலிட்டிக்ஸ் பொத்தானை அழுத்தவும்.`,
        timestamp: new Date(),
        actionLink: {
          label: 'அனலிட்டிக்ஸ் திறக்க',
          path: prefixPath('/analytics')
        }
      };
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `Live operational summary for **${liveStats.clinicName || 'Clinic'}**:\n\n• **Yesterday's visits:** ${liveStats.yesterdayVisits}\n• **Today's visits:** ${liveStats.todayVisits.total} (${liveStats.todayVisits.waiting} waiting, ${liveStats.todayVisits.inCabin} in cabin, ${liveStats.todayVisits.completed} completed)\n• **Total registered patients:** ${liveStats.totalPatients}\n• **Month-to-date visits:** ${liveStats.monthVisits}\n\nTo view interactive footfall charts (daily/weekly/monthly), peak consultation hours, diagnosis trends, and patient demographics, open the Analytics module below.`,
      timestamp: new Date(),
      actionLink: {
        label: 'Open Analytics Page',
        path: prefixPath('/analytics')
      }
    };
  }

  // 6. Fallback: Multilingual Feature Explanations
  const isFeatureQuery = (
    lowerQuery.includes('feature') ||
    lowerQuery.includes('explain') ||
    lowerQuery.includes('v1.4') ||
    lowerQuery.includes('pudhu') ||
    lowerQuery.includes('update') ||
    lowerQuery.includes('changelog') ||
    lowerQuery.includes('indha app') ||
    lowerQuery.includes('app oda') ||
    lowerQuery.includes('vasadhi') ||
    lowerQuery.includes('modules') ||
    lowerQuery.includes('about prescripto')
  );

  if (isFeatureQuery) {
    if (prefersTamil) {
      const tamilSummary = [
        '1. **VisionOS மொபைல் டாக்:** மொபைல் திரையில் எங்கு வேண்டுமானாலும் நகர்த்தக்கூடிய மிதக்கும் கண்ணாடி டாக். டபுள்-டேப் செய்தால் மையத்திற்கு வந்துவிடும்.',
        '2. **ஜீரோ-லேக் நேவிகேஷன்:** பக்கங்கள் அல்லது டேப்கள் மாற்றும்போது தாமதமின்றி உடனடி மாற்றம் மற்றும் ஒளிரும் இன்டிகேட்டர்.',
        '3. **ஆல்-இன்-ஒன் மாடியூல் லான்ச்சர்:** ஸ்க்ரோல் செய்யத் தேவையின்றி ஒரே திரையில் 4-நெடுவரிசை கட்டத்தில் அனைத்து வசதிகளையும் (பதிவு, கன்சல்ட்டேஷன், பிரிண்ட், அனலிட்டிக்ஸ்) அணுகலாம்.',
        '4. **டிவி டிஸ்ப்ளே ஆடியோ மணி (Chime):** காத்திருப்பு அறையில் டோக்கன் அழைக்கும் போது தானியங்கி ஆடியோ மணி ஒலி இயல்பாகவே ஒலிக்கும்.',
        '5. **டிஜிட்டல் பிரஸ்கிரிப்ஷன்:** மருத்துவர்கள் தட்டச்சு செய்தோ அல்லது ஸ்டைலஸ் வரைவு மூலமாகவோ மருந்துச் சீட்டுகளை வழங்கி உடனடி பிரிண்ட் வரிசைக்கு அனுப்பலாம்.',
        '6. **முழுமையான கிளினிக் பாதுகாப்பு:** கிளினிக் பிராண்டிங் மற்றும் மருத்துவத் தரவுகள் பாதுகாப்பாக தனிமைப்படுத்தப்பட்டுள்ளது.'
      ].join('\n\n');

      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `வணக்கம்! **PreScripto (by Zevox)**-இன் முக்கிய வசதிகள் மற்றும் v1.4 பதிப்பின் சிறப்பம்சங்கள்:\n\n${tamilSummary}\n\nஉங்களுக்கு குறிப்பிட்ட அம்சத்தை இயக்க வழிகாட்டுதல் தேவைப்பட்டால் என்னிடம் கேட்கலாம்!`,
        timestamp: new Date(),
        actionLink: {
          label: 'முழு விவரங்களை காண்',
          path: prefixPath('/about')
        }
      };
    }

    const summary = V14_FEATURES.map((f, i) => `${i + 1}. **${f.title}**: ${f.description}`).join('\n\n');
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `Key highlights and features of **PreScripto (by Zevox)** v1.4.0:\n\n${summary}`,
      timestamp: new Date(),
      actionLink: {
        label: 'View Detailed Changelog',
        path: prefixPath('/about')
      }
    };
  }

  // Procedural how-to guides
  const knowledge = searchAppKnowledge(query);
  if (knowledge.matchedGuide) {
    const guide = knowledge.matchedGuide;
    if (prefersTamil) {
      const title = guide.titleTa || guide.title;
      const steps = (guide.stepsTa || guide.steps).map((s, i) => `${i + 1}. ${s}`).join('\n\n');
      const actionLabel = guide.actionLabelTa || guide.actionLabel;
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `### ${title}\n\n${steps}`,
        timestamp: new Date(),
        actionLink: {
          label: actionLabel,
          path: prefixPath(guide.targetPath)
        }
      };
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `### ${guide.title}\n\n${guide.steps.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}`,
      timestamp: new Date(),
      actionLink: {
        label: guide.actionLabel,
        path: prefixPath(guide.targetPath)
      }
    };
  }

  // Pure Greetings
  const isPureGreeting = /^(hi|hello|hey|vanakkam|வணக்கம்|good\s*(morning|afternoon|evening)|hola)\b/i.test(query.trim());
  if (isPureGreeting) {
    if (prefersTamil) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `வணக்கம்! நான் **Nova by Zevox**, உங்கள் கிளினிக் உதவியாளர்.\n\nநோயாளி விவரங்கள், கடவுச்சொல் மீட்டமைப்பு, மருந்துச் சீட்டு வழிகாட்டுதல், வைட்டல்ஸ் அல்லது அமைப்புகள் குறித்து நீங்கள் எதையும் கேட்கலாம்!`,
        timestamp: new Date()
      };
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `Hello! I am **Nova by Zevox**, your clinic operations and clinical AI assistant.\n\nHow can I help you today? You can ask about patient history, password reset, printing prescriptions, clinical vitals, or system settings.`,
      timestamp: new Date()
    };
  }

  // Contextual Smart Guidance for Any Other Query
  if (prefersTamil) {
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `**"${query}"** தொடர்பான கிளினிக் வழிகாட்டுதல்:\n\n` +
        `• **கடவுச்சொல் / பணியாளர் மேலாண்மை:** பாஸ்வேர்ட் மீட்டமைக்க அல்லது ஊழியர்களை நிர்வகிக்க **Team Management** (/users) செல்லவும்.\n` +
        `• **கிளினிக் அமைப்புகள் & தீம்கள்:** கிளினிக் பெயர், முகவரி, லோகோ மற்றும் வண்ணங்களை மாற்ற **Settings** (/settings) செல்லவும்.\n` +
        `• **டாக்டர் ஆலோசனை & பிரஸ்கிரிப்ஷன்:** நோயாளிக்கு மருந்துச் சீட்டு எழுத **Consultation** (/consultation) பயன்படுத்தவும்.\n` +
        `• **பிரிண்ட் & டிவி வரிசை:** **Print Queue** (/print) அல்லது **TV Display** (/display) செல்லவும்.\n\n` +
        `💡 *முழுமையான AI மருத்துவ உரையாடல்கள் மற்றும் விரிவான பதில்களை இயக்க, Nova தலைப்பில் உள்ள சாவி (Key) குறியீட்டை அழுத்தி உங்கள் இலவச Google Gemini API Key-ஐ இணைத்துக் கொள்ளலாம்.*`,
      timestamp: new Date(),
      actionLink: {
        label: 'கிளினிக் அமைப்புகள்',
        path: prefixPath('/settings')
      }
    };
  }

  return {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    text: `Operational guidance for: **"${query}"**\n\n` +
      `Here are direct steps for related clinical operations in PreScripto:\n\n` +
      `• **User Accounts & Password Reset:** The Clinic Owner can reset credentials or update roles under **Team Management** (/users).\n` +
      `• **Clinic Letterhead & Themes:** Update branding, logos, doctor credentials, and UI appearance in **Settings** (/settings).\n` +
      `• **Clinical Records & Prescriptions:** Conduct consultations and draw/type prescriptions under **Consultation** (/consultation).\n` +
      `• **Patient Vitals & Intake:** Register patients and triage baseline vitals under **Patient Entry** (/nurse).\n` +
      `• **Prescription Printing & TV Display:** Access **Print Queue** (/print) or **TV Display** (/display).\n\n` +
      `💡 *Tip: To enable open-ended clinical reasoning, medical explanations, and unrestricted conversational AI, connect a Google Gemini API key by clicking the key icon in the Nova header.*`,
    timestamp: new Date(),
    actionLink: {
      label: 'Open Clinic Settings',
      path: prefixPath('/settings')
    }
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

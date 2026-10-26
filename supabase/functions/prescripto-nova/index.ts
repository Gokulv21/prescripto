import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 1. Strict CORS Allowlist
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)?github\.io$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)?vercel\.app$/,
]

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin')
  const allowed = isOriginAllowed(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? (origin as string) : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(req)

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin)) {
      return new Response('Forbidden origin', { status: 403 })
    }
    return new Response('ok', { headers: corsHeaders })
  }

  // Reject unauthorized origins for actual POST requests
  if (origin && !isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({ error: 'Access denied: Unauthorized domain origin.' }),
      { headers: { 'Content-Type': 'application/json' }, status: 403 }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // 1. Verify user authentication (Reject unauthenticated users)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user session.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Validate request input & payload size
    const body = await req.json().catch(() => ({}))
    const { message, clinicId, userRole } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid query: message content is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Input length limit: Cap to 500 characters to prevent token exhaustion attacks
    if (message.length > 500) {
      return new Response(JSON.stringify({ error: 'Query exceeds max length limit of 500 characters.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Rate Limit Enforcement: Max 20 AI queries per minute per user
    const { data: rateAllowed } = await supabaseClient.rpc('check_rate_limit', {
      p_identifier: user.id,
      p_bucket: 'nova-ai-query',
      p_max_requests: 20,
      p_interval_seconds: 60,
    })

    if (rateAllowed === false) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded: Please wait a moment before sending more AI queries.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Query patients with strict clinic multi-tenant isolation
    let patientMatches: any[] = []
    if (message && clinicId && typeof clinicId === 'string') {
      const clean = message.replace(/(search|patient|find|details for)/gi, '').trim()
      if (clean.length >= 2) {
        const { data } = await supabaseClient
          .from('patients')
          .select('id, name, title, age, sex, phone, registration_id, reg_no, last_opened_at')
          .eq('clinic_id', clinicId)
          .ilike('name', `%${clean}%`)
          .limit(5)
        patientMatches = data || []
      }
    }

    // 5. Call Google Gemini AI with server-side secret API key (zero client leakage)
    if (geminiApiKey) {
      const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
      
      for (const model of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`
          const prompt = `You are the Prescripto AI Clinical & Operations Assistant ("Nova") by Zevox.
Assisting clinic doctors, owners, and reception staff.
Clinic ID: ${clinicId || 'Unknown'}
User Role: ${userRole || 'Staff'}

Rules:
1. Be concise, clinically accurate, and polite.
2. If asked in Tamil or Tanglish, reply fluently in Tamil/Tanglish.
3. If asked about features, highlight Prescripto v1.4 features (VisionOS floating dock, TV token audio chime, zero-lag transitions, all-in-one launcher).
4. If search results are provided, summarize patient records accurately.

User Question: ${message}
Matching Patients found in clinic: ${JSON.stringify(patientMatches)}`

          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 600,
              }
            })
          })

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
            if (text) {
              return new Response(
                JSON.stringify({
                  text,
                  patientCards: patientMatches.length > 1 ? patientMatches : undefined,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
        } catch {
          // Model fallback loop
        }
      }
    }

    // 6. Fast deterministic fallback if Gemini key is not configured or temporary model outage
    let replyText = `Received your query: "${message}".`
    if (patientMatches.length > 0) {
      replyText = `Found ${patientMatches.length} patient record(s) matching your request in this clinic.`
    }

    return new Response(
      JSON.stringify({
        text: replyText,
        patientCards: patientMatches.length > 0 ? patientMatches : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // Keep internal error details and secrets out of server responses
    return new Response(JSON.stringify({ error: 'An unexpected processing error occurred. Please try again later.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

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
    const { message, clinicId, userRole, clinicContext, history } = body

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
      const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']

      const systemInstruction = `You are "Nova", the clinical, medical, and clinic-operations AI assistant created by Zevox for PreScripto.
Assisting clinic doctors, owners, and reception staff.
Clinic ID: ${clinicId || 'Unknown'}
User Role: ${userRole || 'Staff'}
${typeof clinicContext === 'string' && clinicContext ? `\n${clinicContext.slice(0, 2000)}\n` : ''}
Rules:
1. Answer ANY question the user asks clearly, accurately, and directly (clinical/medical, dosages, general questions, or PreScripto operations).
2. If asked in Tamil or Tanglish, reply fluently in Tamil/Tanglish.
3. If asked about features, highlight Prescripto v1.5 features (Nova Clinical AI Copilot, custom themes & HEX picker, VisionOS floating dock, TV token audio chime, strict multi-clinic isolation).
4. If matching patient records are provided, summarize them accurately.`

      const turns: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
      if (Array.isArray(history)) {
        for (const h of history.slice(-8)) {
          if (!h?.text) continue
          const role = h.sender === 'user' ? 'user' : 'model'
          if (turns.length === 0 && role !== 'user') continue
          if (turns.length > 0 && turns[turns.length - 1].role === role) {
            turns[turns.length - 1].parts[0].text += `\n${String(h.text)}`
          } else {
            turns.push({ role, parts: [{ text: String(h.text) }] })
          }
        }
      }
      const userPrompt = patientMatches.length > 0
        ? `${message}\n\nMatching Patients found in clinic: ${JSON.stringify(patientMatches)}`
        : message
      if (turns.length > 0 && turns[turns.length - 1].role === 'user') {
        turns[turns.length - 1].parts[0].text += `\n${userPrompt}`
      } else {
        turns.push({ role: 'user', parts: [{ text: userPrompt }] })
      }
      
      for (const model of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`

          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: turns,
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048,
              }
            })
          })

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            const parts = geminiData.candidates?.[0]?.content?.parts || []
            const text = parts
              .filter((p: any) => !p?.thought && typeof p?.text === 'string')
              .map((p: any) => p.text)
              .join('')
              .trim()
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
        fallback: true,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { message, clinicId, userRole } = await req.json()

    // Query patients with clinic isolation
    let patientMatches: any[] = []
    if (message && clinicId) {
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

    // Call Google Gemini API if key is present
    if (geminiApiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`
      const prompt = `You are the Prescripto AI Clinical & Operations Co-Pilot for a hospital/clinic software.
Role: Assisting clinic doctors, owners, and reception staff.
Clinic ID: ${clinicId || 'Unknown'}
User Role: ${userRole || 'Staff'}

Rules:
1. Be concise, respectful, and clinically accurate.
2. If the user asks about new features, highlight Prescripto v1.4 changes (VisionOS mobile floating dock, TV audio chime, zero-lag micro transitions, compact all-modules launcher).
3. If they asked to find a patient, refer to the search results provided.

User Question: ${message}
Matching Patients found in clinic: ${JSON.stringify(patientMatches)}`

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600,
          }
        })
      })

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json()
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
        return new Response(
          JSON.stringify({
            text,
            patientCards: patientMatches.length > 1 ? patientMatches : undefined,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Default fast reply if no Gemini API key configured
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

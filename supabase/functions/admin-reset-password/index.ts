import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 1. Strict CORS Allowlist: Local development + Production domains
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Authenticate caller
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Valid administrative session required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // 2. Validate request body and password complexity
    const body = await req.json().catch(() => ({}))
    const { userId, newPassword, requestId } = body

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: Target user identifier is missing.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (newPassword.length > 72) {
      return new Response(
        JSON.stringify({ error: 'Password cannot exceed 72 characters.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 3. Rate Limit Enforcement: Max 1 password reset per account every 30 days (1 month)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentResets } = await adminClient
      .from('password_reset_requests')
      .select('id, updated_at')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('updated_at', thirtyDaysAgo)
      .limit(1)

    // Check rate_limits table bucket for this account
    const { data: allowedRate } = await adminClient.rpc('check_rate_limit', {
      p_identifier: `pwd_reset_${userId}`,
      p_bucket: 'password-reset-account',
      p_max_requests: 1,
      p_interval_seconds: 30 * 24 * 3600 // 30 days in seconds
    })

    if ((recentResets && recentResets.length > 0) || allowedRate === false) {
      return new Response(
        JSON.stringify({ 
          error: 'Security Policy: Password can only be reset once every 30 days for this account.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }
    
    // 4. Validate clinic authorization (target user and caller must belong to the same clinic, or caller is superadmin)
    const { data: adminProfile } = await supabaseClient
      .from('profiles')
      .select('clinic_id, is_superadmin')
      .eq('user_id', user.id)
      .single()

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', userId)
      .single()

    if (!adminProfile || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found in clinic records.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const isSameClinic = adminProfile.clinic_id && adminProfile.clinic_id === targetProfile.clinic_id
    const isSuper = adminProfile.is_superadmin === true

    if (!isSameClinic && !isSuper) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have permission to reset passwords for this clinic account.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // 5. Update password via Supabase Admin SDK
    const { error: resetError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword.trim() }
    )

    if (resetError) {
      console.error('[admin-reset-password] Admin update error:', resetError)
      return new Response(
        JSON.stringify({ error: 'Failed to update user password. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 6. Mark request as approved if requestId was provided
    if (requestId) {
      await adminClient
        .from('password_reset_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
    }

    return new Response(
      JSON.stringify({ message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    // 7. Sanitized Error Response - Never leak DB schema or stack trace details
    console.error('[admin-reset-password unexpected error]:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred while resetting password. Please contact support.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

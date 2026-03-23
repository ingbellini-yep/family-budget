// Supabase Edge Function: send-invite
// POST /functions/v1/send-invite
// Body: { email: string; role: string; allowed_sections?: string[]; pocket_money_limit?: number }
//
// Setup secrets (run once):
//   supabase secrets set RESEND_API_KEY=re_xxxxx
//   supabase secrets set APP_URL=https://family-budget-be2l.vercel.app
//
// Deploy:
//   supabase functions deploy send-invite

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'https://family-budget-be2l.vercel.app'

    // Authenticated Supabase client (caller)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify caller is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Service-role client for DB writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Load caller profile
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('family_id, role, full_name, email')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.family_id) {
      return new Response(JSON.stringify({ error: 'No family associated' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can send invites' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const body = await req.json()
    const { email, role, allowed_sections, pocket_money_limit } = body

    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'email and role are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const validRoles = ['admin', 'editor', 'viewer', 'dependent', 'readonly']
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for existing pending invite for this email+family
    const { data: existingInvite } = await supabaseAdmin
      .from('family_invites')
      .select('id, status')
      .eq('family_id', callerProfile.family_id)
      .eq('email', email.toLowerCase())
      .in('status', ['pending'])
      .maybeSingle()

    let inviteToken: string
    let inviteId: string

    if (existingInvite) {
      // Renew the existing invite: generate new token and reset expiry
      const { data: renewedInvite, error: renewError } = await supabaseAdmin
        .from('family_invites')
        .update({
          role,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existingInvite.id)
        .select('token, id')
        .single()

      if (renewError || !renewedInvite) {
        return new Response(JSON.stringify({ error: 'Failed to renew invite' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      inviteToken = renewedInvite.token
      inviteId = renewedInvite.id
    } else {
      // Create new invite
      const { data: newInvite, error: insertError } = await supabaseAdmin
        .from('family_invites')
        .insert({
          family_id: callerProfile.family_id,
          invited_by: user.id,
          email: email.toLowerCase(),
          role,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('token, id')
        .single()

      if (insertError || !newInvite) {
        return new Response(JSON.stringify({ error: 'Failed to create invite' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      inviteToken = newInvite.token
      inviteId = newInvite.id
    }

    // Get family name
    const { data: family } = await supabaseAdmin
      .from('families')
      .select('name')
      .eq('id', callerProfile.family_id)
      .single()

    const familyName = family?.name || 'Family Budget'
    const inviterName = callerProfile.full_name || callerProfile.email
    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`

    const roleLabels: Record<string, string> = {
      admin: 'Amministratore',
      editor: 'Membro completo',
      viewer: 'Sola lettura',
      dependent: 'Dipendente (pocket money)',
      readonly: 'Solo dashboard',
    }
    const roleLabel = roleLabels[role] || role

    let emailSent = false
    let emailError: string | null = null

    // Send email via Resend if API key is configured
    if (resendApiKey) {
      const emailBody = {
        from: 'Family Budget <noreply@resend.dev>',
        to: [email.toLowerCase()],
        subject: `Invito a ${familyName} su Family Budget`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 520px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: #2563eb; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">💰 Family Budget</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Sei stato invitato</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
        <strong>${inviterName}</strong> ti ha invitato a partecipare alla famiglia <strong>${familyName}</strong>
        su Family Budget con ruolo <strong>${roleLabel}</strong>.
      </p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 28px;">
        Clicca sul pulsante qui sotto per accettare l'invito. Il link scade tra 7 giorni.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}"
           style="background: #2563eb; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; display: inline-block;">
          Accetta invito →
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        Oppure copia questo link nel browser:<br>
        <span style="color: #6b7280; font-family: monospace;">${inviteUrl}</span>
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
        Se non ti aspettavi questo invito, puoi ignorare questa email.
      </p>
    </div>
  </div>
</body>
</html>
        `.trim(),
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailBody),
      })

      if (resendRes.ok) {
        emailSent = true
      } else {
        const resendErr = await resendRes.text()
        emailError = `Resend error: ${resendErr}`
        console.error('Resend error:', resendErr)
      }
    } else {
      // No Resend key — still create the invite, return the link
      emailError = 'RESEND_API_KEY not configured — email not sent'
    }

    return new Response(JSON.stringify({
      success: true,
      inviteId,
      inviteUrl,       // always returned so admin can share manually
      emailSent,
      emailError,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('send-invite error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

import { serve } from 'https://deno.land/std@0.204.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') ??
  Deno.env.get('POP_SERVICE_ROLE_KEY') ??
  ''
const POP_SYNC_KEY = Deno.env.get('POP_SYNC_KEY') ?? ''
const POP_WORKSPACE_ID = Deno.env.get('POP_WORKSPACE_ID') ?? ''
const POP_ALLOWED_ORIGIN = Deno.env.get('POP_ALLOWED_ORIGIN') ?? '*'

const corsHeaders = {
  'access-control-allow-origin': POP_ALLOWED_ORIGIN,
  'access-control-allow-headers': 'authorization, x-pop-key, content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
}

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
  })

const getAuthKey = (req: Request) => {
  const headerKey = req.headers.get('x-pop-key')
  if (headerKey) {
    return headerKey
  }
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return null
  }
  return auth.slice(7).trim()
}

const ensureConfig = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !POP_SYNC_KEY || !POP_WORKSPACE_ID) {
    return 'Config ausente no servidor.'
  }
  return null
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const missingConfig = ensureConfig()
  if (missingConfig) {
    return jsonResponse(500, { error: missingConfig })
  }

  const key = getAuthKey(req)
  if (!key || key !== POP_SYNC_KEY) {
    return jsonResponse(401, { error: 'Nao autorizado.' })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('erp_states')
      .select('payload, updated_at')
      .eq('user_id', POP_WORKSPACE_ID)
      .maybeSingle()

    if (error) {
      return jsonResponse(500, { error: error.message })
    }
    return jsonResponse(200, {
      payload: (data?.payload as Record<string, unknown> | null) ?? null,
      updatedAt: data?.updated_at ?? null,
    })
  }

  if (req.method === 'POST') {
    let body: { payload?: unknown; trackingPayloads?: unknown[] } | null = null
    try {
      body = (await req.json()) as { payload?: unknown; trackingPayloads?: unknown[] }
    } catch {
      return jsonResponse(400, { error: 'JSON invalido.' })
    }

    if (!body?.payload || typeof body.payload !== 'object') {
      return jsonResponse(400, { error: 'Payload obrigatorio.' })
    }

    const { error } = await supabase.from('erp_states').upsert(
      {
        user_id: POP_WORKSPACE_ID,
        payload: body.payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) {
      return jsonResponse(500, { error: error.message })
    }

    const rawTracking = Array.isArray(body.trackingPayloads)
      ? body.trackingPayloads
      : []
    if (rawTracking.length > 0) {
      const rows: Array<{ order_id: string; workspace_id: string; payload: unknown }> =
        []
      const seen = new Set<string>()
      rawTracking.forEach((payload) => {
        if (!payload || typeof payload !== 'object') {
          return
        }
        const orderId = String((payload as { orderId?: string }).orderId ?? '').trim()
        const orderCode = String((payload as { orderCode?: string }).orderCode ?? '').trim()
        const keyValue = (orderCode || orderId).toLowerCase()
        if (!keyValue || seen.has(keyValue)) {
          return
        }
        seen.add(keyValue)
        rows.push({
          order_id: keyValue,
          workspace_id: POP_WORKSPACE_ID,
          payload,
        })
      })
      if (rows.length > 0) {
        const trackingResult = await supabase.from('tracking_orders').upsert(rows, {
          onConflict: 'order_id',
        })
        if (trackingResult.error) {
          return jsonResponse(500, { error: trackingResult.error.message })
        }
      }
    }

    return jsonResponse(200, { ok: true })
  }

  return jsonResponse(405, { error: 'Metodo nao permitido.' })
})

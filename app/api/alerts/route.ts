import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { safeLogger } from '../../../lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: alerts, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      safeLogger.logDbError('fetch_alerts', new Error(error.message), { userId: user.id })
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
    }

    return NextResponse.json({ alerts: alerts || [] })

  } catch (error) {
    safeLogger.logError('GET /api/alerts failed', error instanceof Error ? error : new Error(String(error)), { method: 'GET' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { symbol, condition, targetPrice, message } = await request.json()

    if (!symbol || !condition || !targetPrice) {
      return NextResponse.json(
        { error: 'Symbol, condition, and target price are required' },
        { status: 400 }
      )
    }

    const { data: alert, error } = await supabase
      .from('user_alerts')
      .insert({
        user_id: user.id,
        ticker: symbol.toUpperCase(),
        condition,
        target_price: parseFloat(targetPrice),
        message: message || `Price alert for ${symbol}`,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      safeLogger.logDbError('create_alert', new Error(error.message), { userId: user.id, symbol })
      return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Alert created successfully',
      alert
    })

  } catch (error) {
    safeLogger.logError('POST /api/alerts failed', error instanceof Error ? error : new Error(String(error)), { method: 'POST' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
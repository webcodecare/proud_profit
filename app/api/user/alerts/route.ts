import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status, supabase } = await requireUserAuth(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    if (!user || !supabase) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const { data: alerts, error: dbError } = await supabase
      .from('user_alerts')
      .select(`
        *,
        tickers!inner(symbol, name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('Alerts fetch error:', dbError)
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
    }

    return NextResponse.json({ alerts })

  } catch (error) {
    console.error('User alerts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status, supabase } = await requireUserAuth(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    if (!user || !supabase) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const { ticker, condition, target_price, direction, message } = await request.json()

    if (!ticker || !condition || !target_price) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, condition, target_price' },
        { status: 400 }
      )
    }

    const { data: alert, error } = await supabase
      .from('user_alerts')
      .insert({
        user_id: user.id,
        ticker: ticker.toUpperCase(),
        condition,
        target_price: parseFloat(target_price),
        direction: direction || 'above',
        message: message || `Price alert for ${ticker}`,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Alert creation error:', error)
      return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Alert created successfully',
      alert
    })

  } catch (error) {
    console.error('User alert creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
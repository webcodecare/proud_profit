import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's trading trades/history
    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    return NextResponse.json({
      trades: trades || [],
      total: trades?.length || 0
    })

  } catch (error) {
    console.error('Trading trades error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { symbol, type, amount, price, stop_loss, take_profit } = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create new trade
    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        user_id: user.id,
        symbol,
        type, // buy or sell
        amount,
        price,
        stop_loss,
        take_profit,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ trade })

  } catch (error) {
    console.error('Create trade error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
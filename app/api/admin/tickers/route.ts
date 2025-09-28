import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')
    const category = searchParams.get('category')

    // Get tickers from available_tickers table
    let query = supabase
      .from('available_tickers')
      .select('*')
      .order('symbol')
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.ilike('symbol', `%${search}%`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: tickers, error } = await query

    if (error) {
      throw error
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('available_tickers')
      .select('*', { count: 'exact' })

    // Get enabled/disabled counts
    const { count: enabledCount } = await supabase
      .from('available_tickers')
      .select('*', { count: 'exact' })
      .eq('is_enabled', true)

    return NextResponse.json({
      tickers: tickers || [],
      pagination: {
        total: totalCount || 0,
        offset,
        limit,
        has_more: (totalCount || 0) > offset + limit
      },
      stats: {
        total_tickers: totalCount || 0,
        enabled_tickers: enabledCount || 0,
        disabled_tickers: (totalCount || 0) - (enabledCount || 0)
      }
    })

  } catch (error) {
    console.error('Get admin tickers error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { symbol, description, category, market_cap, is_enabled } = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Create new ticker
    const { data: ticker, error } = await supabase
      .from('available_tickers')
      .insert({
        symbol: symbol.toUpperCase(),
        description,
        category: category || 'cryptocurrency',
        market_cap: market_cap || 999,
        is_enabled: is_enabled !== false
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      ticker,
      message: 'Ticker created successfully'
    })

  } catch (error) {
    console.error('Create ticker error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
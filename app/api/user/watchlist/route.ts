import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status } = await requireUserAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const supabase = createClient()

    const { data: watchlist, error } = await supabase
      .from('user_watchlist')
      .select(`
        id,
        symbol,
        created_at,
        tickers (
          symbol,
          name,
          category
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Watchlist fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 })
    }

    return NextResponse.json({ watchlist: watchlist || [] })

  } catch (error) {
    console.error('Watchlist error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status } = await requireUserAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const supabase = createClient()

    const { symbol } = await request.json()

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    // Check if already in watchlist
    const { data: existing } = await supabase
      .from('user_watchlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('symbol', symbol.toUpperCase())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Symbol already in watchlist' }, { status: 409 })
    }

    const { data: watchlistItem, error } = await supabase
      .from('user_watchlist')
      .insert({
        user_id: user.id,
        symbol: symbol.toUpperCase()
      })
      .select()
      .single()

    if (error) {
      console.error('Watchlist add error:', error)
      return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Added to watchlist successfully',
      item: watchlistItem
    })

  } catch (error) {
    console.error('Watchlist add error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
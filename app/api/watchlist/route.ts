import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: watchlistItems, error } = await supabase
      .from('user_watchlist')
      .select(`
        *,
        market_data (
          symbol,
          price,
          change_24h,
          change_percentage_24h,
          volume,
          market_cap
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Failed to fetch watchlist:', error)
      return NextResponse.json(
        { error: 'Failed to fetch watchlist' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      watchlist: watchlistItems || [],
      total: watchlistItems?.length || 0
    })
    
  } catch (error) {
    console.error('Watchlist API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { symbol, notes } = await request.json()
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }
    
    // Check if already in watchlist
    const { data: existing } = await supabase
      .from('user_watchlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('symbol', symbol.toUpperCase())
      .single()
    
    if (existing) {
      return NextResponse.json(
        { error: 'Symbol already in watchlist' },
        { status: 409 }
      )
    }
    
    const watchlistData = {
      user_id: user.id,
      symbol: symbol.toUpperCase(),
      notes: notes || '',
      created_at: new Date().toISOString()
    }
    
    const { data: watchlistItem, error } = await supabase
      .from('user_watchlist')
      .insert(watchlistData)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to add to watchlist:', error)
      return NextResponse.json(
        { error: 'Failed to add to watchlist' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Added to watchlist successfully',
      watchlist_item: watchlistItem
    }, { status: 201 })
    
  } catch (error) {
    console.error('Add to watchlist error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { symbol } = await request.json()
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }
    
    const { error } = await supabase
      .from('user_watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('symbol', symbol.toUpperCase())
    
    if (error) {
      console.error('Failed to remove from watchlist:', error)
      return NextResponse.json(
        { error: 'Failed to remove from watchlist' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Removed from watchlist successfully'
    })
    
  } catch (error) {
    console.error('Remove from watchlist error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
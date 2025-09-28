import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { symbol, side, quantity, order_type = 'market', price } = await request.json()
    
    if (!symbol || !side || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: symbol, side, quantity' },
        { status: 400 }
      )
    }
    
    if (!['buy', 'sell'].includes(side)) {
      return NextResponse.json(
        { error: 'Side must be either "buy" or "sell"' },
        { status: 400 }
      )
    }
    
    if (!['market', 'limit'].includes(order_type)) {
      return NextResponse.json(
        { error: 'Order type must be either "market" or "limit"' },
        { status: 400 }
      )
    }
    
    if (order_type === 'limit' && !price) {
      return NextResponse.json(
        { error: 'Price is required for limit orders' },
        { status: 400 }
      )
    }
    
    // Get current market price for market orders
    let executionPrice = price
    if (order_type === 'market') {
      const { data: marketData } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single()
      
      executionPrice = marketData?.price || price || 50000 // Fallback price
    }
    
    // Generate unique trade ID
    const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create trade record
    const tradeData = {
      trade_id: tradeId,
      user_id: user.id,
      symbol,
      side,
      quantity: parseFloat(quantity),
      order_type,
      requested_price: price ? parseFloat(price) : null,
      execution_price: parseFloat(executionPrice),
      total_value: parseFloat(quantity) * parseFloat(executionPrice),
      status: 'executed',
      executed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }
    
    const { data: trade, error } = await supabase
      .from('trades')
      .insert(tradeData)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create trade:', error)
      return NextResponse.json(
        { error: 'Failed to execute trade' },
        { status: 500 }
      )
    }
    
    // Update user's trading stats
    await supabase.rpc('update_user_trading_stats', {
      p_user_id: user.id,
      p_trade_value: tradeData.total_value
    })
    
    return NextResponse.json({
      message: 'Trade executed successfully',
      trade: {
        id: trade.trade_id,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.execution_price,
        total_value: trade.total_value,
        status: trade.status,
        executed_at: trade.executed_at
      }
    })
    
  } catch (error) {
    console.error('Trade execution error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const symbol = searchParams.get('symbol')
    
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (symbol) {
      query = query.eq('symbol', symbol)
    }
    
    const { data: trades, error } = await query
    
    if (error) {
      console.error('Failed to fetch trades:', error)
      return NextResponse.json(
        { error: 'Failed to fetch trade history' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      trades: trades || [],
      pagination: {
        limit,
        offset,
        hasMore: (trades?.length || 0) === limit
      }
    })
    
  } catch (error) {
    console.error('Trade history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user's portfolio data
    const { data: portfolio, error } = await supabase
      .from('user_portfolios')
      .select(`
        *,
        portfolio_positions (
          symbol,
          quantity,
          average_price,
          current_price,
          total_value,
          pnl,
          pnl_percentage,
          last_updated
        )
      `)
      .eq('user_id', user.id)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Failed to fetch portfolio:', error)
      return NextResponse.json(
        { error: 'Failed to fetch portfolio data' },
        { status: 500 }
      )
    }
    
    // If no portfolio exists, create a default one
    if (!portfolio) {
      const { data: newPortfolio, error: createError } = await supabase
        .from('user_portfolios')
        .insert({
          user_id: user.id,
          total_value: 0,
          total_pnl: 0,
          total_pnl_percentage: 0,
          cash_balance: 10000, // Default demo balance
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Failed to create portfolio:', createError)
        return NextResponse.json(
          { error: 'Failed to create portfolio' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        portfolio: {
          ...newPortfolio,
          portfolio_positions: []
        }
      })
    }
    
    // Calculate portfolio metrics
    const positions = portfolio.portfolio_positions || []
    const totalValue = positions.reduce((sum: number, pos: any) => sum + (pos.total_value || 0), 0)
    const totalPnL = positions.reduce((sum: number, pos: any) => sum + (pos.pnl || 0), 0)
    const totalInvested = positions.reduce((sum: number, pos: any) => sum + (pos.quantity * pos.average_price), 0)
    const totalPnLPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
    
    return NextResponse.json({
      portfolio: {
        ...portfolio,
        calculated_metrics: {
          total_value: totalValue,
          total_pnl: totalPnL,
          total_pnl_percentage: totalPnLPercentage,
          total_invested: totalInvested,
          position_count: positions.length
        }
      }
    })
    
  } catch (error) {
    console.error('Portfolio API error:', error)
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
    
    const { action, symbol, quantity, price } = await request.json()
    
    if (!['buy', 'sell'].includes(action) || !symbol || !quantity || !price) {
      return NextResponse.json(
        { error: 'Invalid request. Required: action (buy/sell), symbol, quantity, price' },
        { status: 400 }
      )
    }
    
    // Execute the trade (simplified simulation)
    const totalCost = quantity * price
    
    // Get or create portfolio
    let { data: portfolio } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (!portfolio) {
      const { data: newPortfolio, error } = await supabase
        .from('user_portfolios')
        .insert({
          user_id: user.id,
          total_value: 0,
          total_pnl: 0,
          cash_balance: 10000,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 })
      }
      portfolio = newPortfolio
    }
    
    // Check cash balance for buy orders
    if (action === 'buy' && portfolio.cash_balance < totalCost) {
      return NextResponse.json(
        { error: 'Insufficient cash balance' },
        { status: 400 }
      )
    }
    
    // Execute the trade
    const tradeData = {
      user_id: user.id,
      symbol,
      action,
      quantity,
      price,
      total_value: totalCost,
      timestamp: new Date().toISOString()
    }
    
    const { error: tradeError } = await supabase
      .from('portfolio_trades')
      .insert(tradeData)
    
    if (tradeError) {
      console.error('Failed to record trade:', tradeError)
      return NextResponse.json(
        { error: 'Failed to execute trade' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Trade executed successfully',
      trade: tradeData
    })
    
  } catch (error) {
    console.error('Portfolio trade error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
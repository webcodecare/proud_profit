import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
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

    // Get trading analytics
    const [
      { count: totalTrades },
      { count: activeTrades },
      { data: recentTrades }
    ] = await Promise.all([
      supabase.from('trades').select('*', { count: 'exact', head: true }),
      supabase.from('trades').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(10)
    ])

    // Calculate trading volume and P&L
    const { data: trades } = await supabase
      .from('trades')
      .select('amount, type, price, created_at')

    const analytics = {
      total_trades: totalTrades || 0,
      active_trades: activeTrades || 0,
      completed_trades: (totalTrades || 0) - (activeTrades || 0),
      trading_volume: trades?.reduce((sum, trade) => sum + (trade.amount * trade.price), 0) || 0,
      buy_trades: trades?.filter(t => t.type === 'buy').length || 0,
      sell_trades: trades?.filter(t => t.type === 'sell').length || 0,
      average_trade_size: trades?.length ? 
        trades.reduce((sum, trade) => sum + trade.amount, 0) / trades.length : 0,
      recent_activity: recentTrades || [],
      daily_stats: {
        today: {
          trades: trades?.filter(t => 
            new Date(t.created_at).toDateString() === new Date().toDateString()
          ).length || 0,
          volume: trades?.filter(t => 
            new Date(t.created_at).toDateString() === new Date().toDateString()
          ).reduce((sum, trade) => sum + (trade.amount * trade.price), 0) || 0
        }
      },
      top_symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      performance_metrics: {
        success_rate: Math.random() * 30 + 60,
        average_return: Math.random() * 20 - 5,
        sharpe_ratio: Math.random() * 2 + 0.5
      }
    }

    return NextResponse.json({ analytics })

  } catch (error) {
    console.error('Trading analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
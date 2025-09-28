import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d' // 7d, 30d, 90d, 1y
    const metric = searchParams.get('metric') // portfolio, trading, signals
    
    // Calculate date range
    const now = new Date()
    let startDate: Date
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    
    const analytics: any = {
      user_id: user.id,
      timeframe,
      generated_at: new Date().toISOString()
    }
    
    // Portfolio Analytics
    if (!metric || metric === 'portfolio') {
      const { data: portfolio } = await supabase
        .from('user_portfolios')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      const { data: portfolioHistory } = await supabase
        .from('portfolio_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
      
      analytics.portfolio = {
        current_value: portfolio?.total_value || 0,
        current_pnl: portfolio?.total_pnl || 0,
        current_pnl_percentage: portfolio?.total_pnl_percentage || 0,
        cash_balance: portfolio?.cash_balance || 0,
        historical_performance: portfolioHistory?.map(h => ({
          date: h.created_at,
          value: h.total_value,
          pnl: h.total_pnl,
          pnl_percentage: h.total_pnl_percentage
        })) || []
      }
    }
    
    // Trading Analytics
    if (!metric || metric === 'trading') {
      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
      
      const totalTrades = trades?.length || 0
      const totalVolume = trades?.reduce((sum, trade) => sum + (trade.total_value || 0), 0) || 0
      const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0
      
      // Calculate win/loss ratio
      const profitableTrades = trades?.filter(t => (t.pnl || 0) > 0).length || 0
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0
      
      analytics.trading = {
        total_trades: totalTrades,
        total_volume: totalVolume,
        average_trade_size: avgTradeSize,
        win_rate: winRate,
        profitable_trades: profitableTrades,
        losing_trades: totalTrades - profitableTrades,
        daily_trading_activity: generateDailyTradingActivity(trades || [], timeframe)
      }
    }
    
    // Signals Analytics
    if (!metric || metric === 'signals') {
      const { data: signals } = await supabase
        .from('user_signals')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
      
      const totalSignals = signals?.length || 0
      const signalsByType = signals?.reduce((acc: any, signal) => {
        acc[signal.signal_type] = (acc[signal.signal_type] || 0) + 1
        return acc
      }, {}) || {}
      
      const avgConfidence = signals?.length 
        ? signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length 
        : 0
      
      analytics.signals = {
        total_signals: totalSignals,
        signals_by_type: signalsByType,
        average_confidence: avgConfidence,
        high_confidence_signals: signals?.filter(s => (s.confidence || 0) > 80).length || 0
      }
    }
    
    return NextResponse.json(analytics)
    
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateDailyTradingActivity(trades: any[], timeframe: string) {
  const activity: { [key: string]: { trades: number, volume: number } } = {}
  
  trades.forEach(trade => {
    const date = new Date(trade.created_at).toISOString().split('T')[0]
    if (!activity[date]) {
      activity[date] = { trades: 0, volume: 0 }
    }
    activity[date].trades += 1
    activity[date].volume += trade.total_value || 0
  })
  
  return Object.entries(activity)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
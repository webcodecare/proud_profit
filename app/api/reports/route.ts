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
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const report_type = searchParams.get('type') // trading, portfolio, signals
    
    let query = supabase
      .from('user_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (report_type) {
      query = query.eq('report_type', report_type)
    }
    
    const { data: reports, error } = await query
    
    if (error) {
      console.error('Failed to fetch reports:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      reports: reports || [],
      pagination: {
        limit,
        offset,
        hasMore: (reports?.length || 0) === limit
      }
    })
    
  } catch (error) {
    console.error('Reports API error:', error)
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
    
    const { report_type, date_range, filters } = await request.json()
    
    if (!report_type) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      )
    }
    
    const reportId = `REPORT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Generate report data based on type
    let reportData: any = {}
    
    switch (report_type) {
      case 'trading_summary':
        reportData = await generateTradingSummary(user.id, date_range, supabase)
        break
      case 'portfolio_performance':
        reportData = await generatePortfolioReport(user.id, date_range, supabase)
        break
      case 'signals_analysis':
        reportData = await generateSignalsReport(user.id, date_range, supabase)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }
    
    const report = {
      report_id: reportId,
      user_id: user.id,
      report_type,
      date_range: date_range || { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: new Date().toISOString() },
      filters: filters || {},
      data: reportData,
      status: 'completed',
      created_at: new Date().toISOString()
    }
    
    const { data: savedReport, error } = await supabase
      .from('user_reports')
      .insert(report)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to save report:', error)
      return NextResponse.json(
        { error: 'Failed to save report' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Report generated successfully',
      report: savedReport
    }, { status: 201 })
    
  } catch (error) {
    console.error('Generate report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function generateTradingSummary(userId: string, dateRange: any, supabase: any) {
  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000)
  
  const totalTrades = trades?.length || 0
  const totalVolume = trades?.reduce((sum: number, trade: any) => sum + (trade.total_value || 0), 0) || 0
  const profitableTrades = trades?.filter((t: any) => (t.pnl || 0) > 0).length || 0
  
  return {
    summary: {
      total_trades: totalTrades,
      total_volume: totalVolume,
      win_rate: totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0,
      average_trade_size: totalTrades > 0 ? totalVolume / totalTrades : 0
    },
    trades_by_symbol: groupTradesBySymbol(trades || []),
    monthly_performance: generateMonthlyPerformance(trades || [])
  }
}

async function generatePortfolioReport(userId: string, dateRange: any, supabase: any) {
  const { data: portfolio } = await supabase
    .from('user_portfolios')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  const { data: history } = await supabase
    .from('portfolio_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(100)
  
  return {
    current_status: portfolio || {},
    performance_history: history || [],
    asset_allocation: generateAssetAllocation(portfolio),
    roi_analysis: calculateROI(history || [])
  }
}

async function generateSignalsReport(userId: string, dateRange: any, supabase: any) {
  const { data: signals } = await supabase
    .from('user_signals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
  
  return {
    total_signals: signals?.length || 0,
    signals_by_type: groupSignalsByType(signals || []),
    accuracy_metrics: calculateSignalAccuracy(signals || []),
    top_performing_signals: getTopPerformingSignals(signals || [])
  }
}

function groupTradesBySymbol(trades: any[]) {
  return trades.reduce((acc: any, trade) => {
    const symbol = trade.symbol || 'UNKNOWN'
    if (!acc[symbol]) {
      acc[symbol] = { count: 0, volume: 0, pnl: 0 }
    }
    acc[symbol].count += 1
    acc[symbol].volume += trade.total_value || 0
    acc[symbol].pnl += trade.pnl || 0
    return acc
  }, {})
}

function generateMonthlyPerformance(trades: any[]) {
  const monthly: any = {}
  trades.forEach(trade => {
    const month = new Date(trade.created_at).toISOString().slice(0, 7)
    if (!monthly[month]) {
      monthly[month] = { trades: 0, volume: 0, pnl: 0 }
    }
    monthly[month].trades += 1
    monthly[month].volume += trade.total_value || 0
    monthly[month].pnl += trade.pnl || 0
  })
  return monthly
}

function generateAssetAllocation(portfolio: any) {
  // Simplified asset allocation
  return {
    crypto: 70,
    cash: 30,
    other: 0
  }
}

function calculateROI(history: any[]) {
  if (history.length < 2) return { roi: 0, period: '0d' }
  
  const initial = history[0]?.total_value || 0
  const current = history[history.length - 1]?.total_value || 0
  const roi = initial > 0 ? ((current - initial) / initial) * 100 : 0
  
  return { roi, period: `${history.length}d` }
}

function groupSignalsByType(signals: any[]) {
  return signals.reduce((acc: any, signal) => {
    const type = signal.signal_type || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})
}

function calculateSignalAccuracy(signals: any[]) {
  const total = signals.length
  const successful = signals.filter(s => s.success === true).length
  return {
    total_signals: total,
    successful_signals: successful,
    accuracy_rate: total > 0 ? (successful / total) * 100 : 0
  }
}

function getTopPerformingSignals(signals: any[]) {
  return signals
    .filter(s => s.confidence && s.confidence > 80)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 10)
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../../../lib/supabase/server'

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

    const serviceSupabase = createServiceClient()

    // Get signal statistics
    const { data: signals } = await serviceSupabase
      .from('signals')
      .select('action, ticker, timestamp, strategy, is_active')
      .order('timestamp', { ascending: false })

    const stats = {
      total: signals?.length || 0,
      active: signals?.filter(s => s.is_active).length || 0,
      byAction: {
        buy: signals?.filter(s => s.action === 'buy').length || 0,
        sell: signals?.filter(s => s.action === 'sell').length || 0,
        hold: signals?.filter(s => s.action === 'hold').length || 0
      },
      byTicker: signals?.reduce((acc, signal) => {
        acc[signal.ticker] = (acc[signal.ticker] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {},
      byStrategy: signals?.reduce((acc, signal) => {
        acc[signal.strategy] = (acc[signal.strategy] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {},
      todayCount: signals?.filter(s => {
        const today = new Date().toDateString()
        return new Date(s.timestamp).toDateString() === today
      }).length || 0,
      weekCount: signals?.filter(s => {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return new Date(s.timestamp) >= weekAgo
      }).length || 0,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('Signal stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
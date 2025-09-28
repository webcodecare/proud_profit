import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { report_type, date_range, filters } = await request.json()
    
    if (!report_type) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      )
    }
    
    // Generate report based on type
    let reportData: any = {}
    
    switch (report_type) {
      case 'user_activity':
        const { data: users } = await supabase
          .from('users')
          .select('id, email, created_at, last_login, role')
          .order('created_at', { ascending: false })
        
        reportData = {
          type: 'user_activity',
          summary: {
            total_users: users?.length || 0,
            new_users_last_30_days: users?.filter(u => 
              new Date(u.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ).length || 0
          },
          data: users?.slice(0, 100) // Limit to 100 for demo
        }
        break
        
      case 'trading_volume':
        const { data: trades } = await supabase
          .from('trades')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000)
        
        const totalVolume = trades?.reduce((sum, trade) => sum + (trade.total_value || 0), 0) || 0
        
        reportData = {
          type: 'trading_volume',
          summary: {
            total_trades: trades?.length || 0,
            total_volume: totalVolume,
            average_trade_size: trades?.length ? totalVolume / trades.length : 0
          },
          data: trades?.slice(0, 50)
        }
        break
        
      case 'signals_performance':
        const { data: signals } = await supabase
          .from('signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500)
        
        const signalTypes = signals?.reduce((acc: any, signal) => {
          acc[signal.signal_type] = (acc[signal.signal_type] || 0) + 1
          return acc
        }, {}) || {}
        
        reportData = {
          type: 'signals_performance',
          summary: {
            total_signals: signals?.length || 0,
            signal_types: signalTypes,
            average_confidence: signals?.length 
              ? signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length 
              : 0
          },
          data: signals?.slice(0, 50)
        }
        break
        
      default:
        return NextResponse.json(
          { error: 'Unsupported report type' },
          { status: 400 }
        )
    }
    
    // Generate unique report ID
    const reportId = `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Store report metadata
    const { error: insertError } = await supabase
      .from('generated_reports')
      .insert({
        report_id: reportId,
        report_type,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
        filters: filters || {},
        data_summary: reportData.summary
      })
    
    if (insertError) {
      console.error('Failed to store report metadata:', insertError)
    }
    
    return NextResponse.json({
      message: 'Report generated successfully',
      report_id: reportId,
      generated_at: new Date().toISOString(),
      report_data: reportData
    })
    
  } catch (error) {
    console.error('Generate report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
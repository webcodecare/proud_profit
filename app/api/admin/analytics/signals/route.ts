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

    // Get signal analytics
    const { data: signals } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })

    const signalsByType = signals?.reduce((acc, signal) => {
      acc[signal.type] = (acc[signal.type] || 0) + 1
      return acc
    }, {}) || {}

    const signalsBySymbol = signals?.reduce((acc, signal) => {
      acc[signal.symbol] = (acc[signal.symbol] || 0) + 1
      return acc
    }, {}) || {}

    return NextResponse.json({
      totalSignals: signals?.length || 0,
      signalsByType,
      signalsBySymbol,
      recentSignals: signals?.slice(0, 10) || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Signal analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
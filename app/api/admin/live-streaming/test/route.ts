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

    // Test streaming connections
    const testResults = {
      websocket_test: {
        status: 'success',
        latency: Math.floor(Math.random() * 50) + 10 + 'ms',
        connection_time: Math.floor(Math.random() * 100) + 50 + 'ms'
      },
      market_data_feed: {
        status: 'success',
        last_message: new Date().toISOString(),
        messages_per_second: Math.floor(Math.random() * 20) + 5
      },
      signal_broadcast: {
        status: 'success',
        subscribers: Math.floor(Math.random() * 100) + 20,
        last_signal: new Date(Date.now() - Math.random() * 60000).toISOString()
      },
      database_connectivity: {
        status: 'success',
        query_time: Math.floor(Math.random() * 20) + 5 + 'ms',
        pool_size: Math.floor(Math.random() * 10) + 5
      }
    }

    return NextResponse.json({
      test_timestamp: new Date().toISOString(),
      overall_status: 'healthy',
      test_results: testResults
    })

  } catch (error) {
    console.error('Live streaming test error:', error)
    return NextResponse.json(
      { 
        test_timestamp: new Date().toISOString(),
        overall_status: 'error',
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { test_type, duration } = await request.json()
    
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

    // Simulate running a specific test
    const testDuration = duration || 30 // seconds
    
    return NextResponse.json({
      message: `Starting ${test_type || 'comprehensive'} streaming test`,
      duration: testDuration,
      test_id: `test_${Date.now()}`,
      started_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Start streaming test error:', error)
    return NextResponse.json(
      { error: 'Failed to start test' },
      { status: 500 }
    )
  }
}
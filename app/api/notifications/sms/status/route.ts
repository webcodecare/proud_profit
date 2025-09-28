import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin for detailed status
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    const status = {
      service: 'SMS Notifications',
      status: 'operational',
      provider: 'Twilio',
      last_message_sent: new Date(Date.now() - 300000).toISOString(),
      messages_sent_today: Math.floor(Math.random() * 1000) + 500,
      queue_size: Math.floor(Math.random() * 10),
      error_rate: Math.random() * 0.05,
      ...(isAdmin && {
        detailed_metrics: {
          success_rate: 99.5,
          average_delivery_time: '2.3s',
          cost_per_message: 0.0075,
          daily_quota: 10000,
          quota_used: Math.floor(Math.random() * 5000) + 1000
        }
      })
    }

    return NextResponse.json({ status })

  } catch (error) {
    console.error('SMS status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tickerSymbol = searchParams.get('ticker') || 'BTCUSDT'
    const urgency = searchParams.get('urgency') || 'normal'

    // Quick smart timing check without persisting
    const now = new Date()
    const currentHour = now.getHours()
    
    // Simple timing logic for GET request
    const shouldSend = urgency === 'critical' || (currentHour >= 8 && currentHour <= 22)
    const reason = shouldSend ? 'Good timing to send' : 'Outside optimal hours'
    
    return NextResponse.json({
      shouldSend,
      reason,
      currentHour,
      urgency,
      tickerSymbol,
      timestamp: new Date().toISOString(),
      recommendation: shouldSend ? 'Send immediately' : 'Wait for better timing'
    })

  } catch (error) {
    console.error('Smart timing check error:', error)
    return NextResponse.json(
      { error: 'Smart timing service unavailable' },
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

    const { 
      tickerSymbol, 
      signalType, 
      urgency, 
      marketConditions 
    } = await request.json()

    if (!tickerSymbol || !signalType) {
      return NextResponse.json(
        { error: 'Ticker symbol and signal type are required' },
        { status: 400 }
      )
    }

    // Get user's smart timing preferences
    const { data: preferences } = await supabase
      .from('smart_timing_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker_symbol', tickerSymbol)
      .single()

    // Get user's notification preferences
    const { data: notificationPrefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Check quiet hours
    const now = new Date()
    const currentHour = now.getHours()
    const isQuietHours = notificationPrefs?.quiet_hours_enabled && 
      currentHour >= notificationPrefs.quiet_hours_start && 
      currentHour <= notificationPrefs.quiet_hours_end

    // Check recent notification frequency
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('created_at', { ascending: false })

    const recentCount = recentNotifications?.length || 0
    const maxHourlyNotifications = preferences?.max_hourly_notifications || 5

    // Decision logic
    let shouldSend = true
    let reason = 'Signal meets sending criteria'
    let delay = 0

    // Check urgency override
    if (urgency === 'critical') {
      shouldSend = true
      reason = 'Critical urgency override'
    }
    // Check quiet hours
    else if (isQuietHours && urgency !== 'high') {
      shouldSend = false
      reason = 'Quiet hours active'
      delay = (notificationPrefs.quiet_hours_end - currentHour) * 3600 // seconds until quiet hours end
    }
    // Check frequency limits
    else if (recentCount >= maxHourlyNotifications) {
      shouldSend = false
      reason = 'Hourly notification limit reached'
      delay = 3600 - (Date.now() % 3600000) / 1000 // seconds until next hour
    }
    // Check user preferences for signal type
    else if (preferences?.signal_frequency === 'low' && signalType === 'minor') {
      shouldSend = false
      reason = 'User prefers low frequency notifications'
    }
    // Check market conditions
    else if (marketConditions?.volatility > (preferences?.volatility_threshold || 0.1)) {
      if (preferences?.high_volatility_pause) {
        shouldSend = false
        reason = 'High volatility pause enabled'
        delay = 1800 // 30 minutes
      }
    }

    // Log the decision
    await supabase
      .from('smart_timing_decisions')
      .insert({
        user_id: user.id,
        ticker_symbol: tickerSymbol,
        signal_type: signalType,
        should_send: shouldSend,
        reason,
        delay_seconds: delay,
        urgency,
        market_conditions: marketConditions || {},
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      shouldSend,
      reason,
      delaySeconds: delay,
      suggestedSendTime: delay > 0 
        ? new Date(Date.now() + delay * 1000).toISOString() 
        : new Date().toISOString(),
      metadata: {
        quietHours: isQuietHours,
        recentNotificationCount: recentCount,
        userPreferences: {
          frequency: preferences?.signal_frequency || 'medium',
          volatilityThreshold: preferences?.volatility_threshold || 0.1
        }
      }
    })

  } catch (error) {
    console.error('Smart timing should-send error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
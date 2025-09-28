import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user trading settings
    const { data: settings } = await supabase
      .from('trading_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const defaultSettings = {
      user_id: user.id,
      risk_tolerance: 'medium',
      max_position_size: 1000,
      stop_loss_percentage: 5,
      take_profit_percentage: 10,
      auto_trading_enabled: false,
      preferred_symbols: ['BTCUSDT', 'ETHUSDT'],
      notification_preferences: {
        email: true,
        sms: false,
        push: true
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return NextResponse.json({
      settings: settings || defaultSettings
    })

  } catch (error) {
    console.error('Trading settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const settingsData = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update or insert trading settings
    const { data: settings, error } = await supabase
      .from('trading_settings')
      .upsert({
        user_id: user.id,
        ...settingsData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ settings })

  } catch (error) {
    console.error('Update trading settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
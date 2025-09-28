import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { optimizationType, parameters, tickerSymbol } = await request.json()

    if (!optimizationType || !tickerSymbol) {
      return NextResponse.json(
        { error: 'Optimization type and ticker symbol are required' },
        { status: 400 }
      )
    }

    // Get user's current smart timing preferences
    const { data: preferences } = await supabase
      .from('smart_timing_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Apply optimization based on type
    let optimizedSettings = {}
    
    switch (optimizationType) {
      case 'aggressive':
        optimizedSettings = {
          signal_frequency: 'high',
          risk_tolerance: 'high',
          volatility_threshold: 0.15,
          profit_target: 0.08,
          stop_loss: 0.05,
          time_window: '5m'
        }
        break
      
      case 'conservative':
        optimizedSettings = {
          signal_frequency: 'low',
          risk_tolerance: 'low',
          volatility_threshold: 0.05,
          profit_target: 0.03,
          stop_loss: 0.02,
          time_window: '1h'
        }
        break
      
      case 'balanced':
        optimizedSettings = {
          signal_frequency: 'medium',
          risk_tolerance: 'medium',
          volatility_threshold: 0.08,
          profit_target: 0.05,
          stop_loss: 0.03,
          time_window: '15m'
        }
        break
      
      case 'custom':
        optimizedSettings = parameters || {}
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid optimization type' },
          { status: 400 }
        )
    }

    // Update or create smart timing preferences
    const { data: updatedPreferences, error } = await supabase
      .from('smart_timing_preferences')
      .upsert({
        user_id: user.id,
        ticker_symbol: tickerSymbol,
        optimization_type: optimizationType,
        settings: optimizedSettings,
        applied_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,ticker_symbol'
      })
      .select()
      .single()

    if (error) {
      console.error('Smart timing optimization error:', error)
      return NextResponse.json(
        { error: 'Failed to apply optimization' },
        { status: 500 }
      )
    }

    // Log the optimization event
    await supabase
      .from('smart_timing_analytics')
      .insert({
        user_id: user.id,
        event_type: 'optimization_applied',
        ticker_symbol: tickerSymbol,
        optimization_type: optimizationType,
        previous_settings: preferences?.settings || {},
        new_settings: optimizedSettings,
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      message: 'Smart timing optimization applied successfully',
      optimization: {
        type: optimizationType,
        tickerSymbol,
        settings: optimizedSettings,
        appliedAt: updatedPreferences.applied_at
      }
    })

  } catch (error) {
    console.error('Smart timing optimization error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
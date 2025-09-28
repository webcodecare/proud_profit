import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      interactionType, 
      tickerSymbol, 
      signalId, 
      action, 
      metadata 
    } = await request.json()

    if (!interactionType || !tickerSymbol) {
      return NextResponse.json(
        { error: 'Interaction type and ticker symbol are required' },
        { status: 400 }
      )
    }

    // Record the interaction
    const { data: interaction, error } = await supabase
      .from('smart_timing_interactions')
      .insert({
        user_id: user.id,
        interaction_type: interactionType, // 'signal_viewed', 'signal_acted', 'settings_changed', etc.
        ticker_symbol: tickerSymbol,
        signal_id: signalId || null,
        action: action || null, // 'buy', 'sell', 'ignore', etc.
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
        session_id: `session_${user.id}_${Date.now()}`
      })
      .select()
      .single()

    if (error) {
      console.error('Smart timing interaction recording error:', error)
      return NextResponse.json(
        { error: 'Failed to record interaction' },
        { status: 500 }
      )
    }

    // Update user's interaction statistics
    const { data: userStats } = await supabase
      .from('smart_timing_user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const updatedStats = {
      total_interactions: (userStats?.total_interactions || 0) + 1,
      interactions_today: interactionType === 'signal_acted' 
        ? (userStats?.interactions_today || 0) + 1 
        : (userStats?.interactions_today || 0),
      last_interaction_at: new Date().toISOString(),
      most_active_ticker: tickerSymbol // Could be improved with more logic
    }

    await supabase
      .from('smart_timing_user_stats')
      .upsert({
        user_id: user.id,
        ...updatedStats,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    // Check if this interaction should trigger smart timing suggestions
    let suggestions = []
    if (interactionType === 'signal_acted' && action === 'ignore') {
      // User ignored a signal, might need to adjust timing
      suggestions.push({
        type: 'timing_adjustment',
        message: 'Consider adjusting your notification timing preferences',
        priority: 'medium'
      })
    }

    return NextResponse.json({
      message: 'Interaction recorded successfully',
      interaction: {
        id: interaction.id,
        type: interactionType,
        timestamp: interaction.timestamp
      },
      suggestions
    })

  } catch (error) {
    console.error('Smart timing interaction error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
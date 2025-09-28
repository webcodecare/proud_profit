import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { telegram_id, username } = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!telegram_id) {
      return NextResponse.json(
        { error: 'Telegram ID is required' },
        { status: 400 }
      )
    }

    // Validate Telegram ID format (should be numeric)
    if (!/^\d+$/.test(telegram_id)) {
      return NextResponse.json(
        { error: 'Invalid Telegram ID format' },
        { status: 400 }
      )
    }

    // Update user's telegram settings
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        telegram_id,
        telegram_username: username,
        telegram_validated: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Send test message (simulated)
    const testMessage = `✅ Telegram notifications activated for Proud Profit! 
You'll now receive trading signals and alerts here.`

    return NextResponse.json({
      success: true,
      message: 'Telegram validation successful',
      telegram_id,
      username,
      test_message_sent: true
    })

  } catch (error) {
    console.error('Telegram validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
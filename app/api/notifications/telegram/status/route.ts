import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Telegram configuration
    const { data: telegramConfig } = await supabase
      .from('user_telegram_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Get Telegram bot status (mock implementation)
    const botStatus = {
      bot_online: true,
      bot_username: 'ProudProfitBot',
      last_seen: new Date().toISOString(),
      webhook_url: process.env.TELEGRAM_WEBHOOK_URL || 'https://api.telegram.org/webhook',
      api_status: 'operational'
    }

    // Get user's Telegram notification stats
    const { data: telegramStats } = await supabase
      .from('notifications')
      .select('id, status, created_at')
      .eq('user_id', user.id)
      .eq('type', 'telegram')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const stats = {
      total_sent_24h: telegramStats?.filter(n => n.status === 'sent').length || 0,
      failed_24h: telegramStats?.filter(n => n.status === 'failed').length || 0,
      pending: telegramStats?.filter(n => n.status === 'pending').length || 0
    }

    return NextResponse.json({
      user_telegram: {
        configured: !!telegramConfig,
        chat_id: telegramConfig?.chat_id || null,
        username: telegramConfig?.username || null,
        notifications_enabled: telegramConfig?.notifications_enabled || false,
        last_message_at: telegramConfig?.last_message_at || null
      },
      bot_status: botStatus,
      statistics: stats,
      connection_status: telegramConfig?.chat_id ? 'connected' : 'not_connected'
    })

  } catch (error) {
    console.error('Telegram status error:', error)
    return NextResponse.json(
      { error: 'Failed to get Telegram status' },
      { status: 500 }
    )
  }
}
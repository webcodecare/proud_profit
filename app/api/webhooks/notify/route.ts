import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    let body;
    try {
      const requestText = await request.text()
      if (!requestText.trim()) {
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        )
      }
      body = JSON.parse(requestText)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { type, message, user_id, data } = body
    
    if (!type || !message) {
      return NextResponse.json(
        { error: 'Type and message are required' },
        { status: 400 }
      )
    }

    // If user_id is provided, send to specific user, otherwise broadcast
    if (user_id) {
      // Send to specific user
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          user_id,
          message,
          type,
          data: data || {},
          read: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        notification,
        recipients: 1
      })
    } else {
      // Broadcast to all users
      const { data: users } = await supabase
        .from('users')
        .select('id')

      if (!users || users.length === 0) {
        return NextResponse.json({
          success: true,
          recipients: 0,
          message: 'No users to notify'
        })
      }

      const notifications = users.map(user => ({
        user_id: user.id,
        message,
        type,
        data: data || {},
        read: false,
        created_at: new Date().toISOString()
      }))

      const { data: insertedNotifications, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        recipients: insertedNotifications?.length || 0,
        notifications: insertedNotifications
      })
    }

  } catch (error) {
    console.error('Webhook notify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
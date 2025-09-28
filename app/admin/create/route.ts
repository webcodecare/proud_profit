import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    return NextResponse.json({
      message: 'Admin creation tools',
      available_actions: [
        'create_user',
        'create_subscription_plan', 
        'create_admin_user',
        'create_test_data',
        'create_notification_template'
      ],
      roles: ['user', 'admin', 'elite'],
      subscription_tiers: ['free', 'basic', 'premium', 'elite']
    })

  } catch (error) {
    console.error('Admin create tools error:', error)
    return NextResponse.json(
      { error: 'Failed to get creation tools' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { action, data: actionData } = await request.json()
    
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    let result;

    switch (action) {
      case 'create_notification_template':
        const { title, message, type = 'info' } = actionData
        
        if (!title || !message) {
          return NextResponse.json(
            { error: 'Title and message are required for notification template' },
            { status: 400 }
          )
        }

        result = await supabase
          .from('notification_templates')
          .insert({
            title,
            message,
            type,
            created_by: user.id,
            created_at: new Date().toISOString()
          })
          .select()
          .single()
        break

      case 'create_test_data':
        const { entity, count = 10 } = actionData
        
        if (!entity) {
          return NextResponse.json(
            { error: 'Entity type is required for test data creation' },
            { status: 400 }
          )
        }

        // Generate test data based on entity type
        const testData = []
        for (let i = 0; i < count; i++) {
          if (entity === 'signals') {
            testData.push({
              ticker: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'][Math.floor(Math.random() * 3)],
              signal_type: ['buy', 'sell'][Math.floor(Math.random() * 2)],
              price: Math.random() * 100000,
              confidence: Math.random() * 100,
              created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
            })
          }
        }

        if (testData.length > 0) {
          result = await supabase
            .from(entity)
            .insert(testData)
            .select()
        }
        break

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    if (result?.error) {
      console.error('Failed to execute admin action:', result.error)
      return NextResponse.json(
        { error: `Failed to execute ${action}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `${action} executed successfully`,
      result: result?.data || { success: true }
    })

  } catch (error) {
    console.error('Admin create action error:', error)
    return NextResponse.json(
      { error: 'Failed to execute admin action' },
      { status: 500 }
    )
  }
}
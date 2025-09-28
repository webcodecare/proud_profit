import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { webhook_url, environment = 'sandbox' } = await request.json()
    
    if (!webhook_url) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      )
    }

    // Store PayPal configuration in database
    const { data: config, error } = await supabase
      .from('paypal_config')
      .upsert({
        webhook_url,
        environment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single()

    if (error) {
      console.error('PayPal setup error:', error)
      return NextResponse.json(
        { error: 'Failed to setup PayPal configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'PayPal setup successful',
      config: {
        webhook_url: config.webhook_url,
        environment: config.environment
      }
    })

  } catch (error) {
    console.error('PayPal setup error:', error)
    return NextResponse.json(
      { error: 'Failed to setup PayPal' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get PayPal configuration
    const { data: config } = await supabase
      .from('paypal_config')
      .select('webhook_url, environment, created_at, updated_at')
      .single()

    if (!config) {
      return NextResponse.json({
        message: 'PayPal not configured',
        configured: false
      })
    }

    return NextResponse.json({
      message: 'PayPal configuration found',
      configured: true,
      config
    })

  } catch (error) {
    console.error('PayPal setup get error:', error)
    return NextResponse.json(
      { error: 'Failed to get PayPal configuration' },
      { status: 500 }
    )
  }
}
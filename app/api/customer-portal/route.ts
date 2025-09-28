import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    // Create customer portal session (simulated for Stripe)
    const portalSession = {
      id: `cs_${Date.now()}`,
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/customer-portal/${subscription.id}`,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/subscription`,
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      customer: user.id,
      subscription: subscription.id
    }

    return NextResponse.json({
      success: true,
      portal_session: portalSession
    })

  } catch (error) {
    console.error('Customer portal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's subscription and billing information
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get payment history
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      subscription: subscription || null,
      payments: payments || [],
      customer: {
        id: user.id,
        email: user.email,
        created: user.created_at
      }
    })

  } catch (error) {
    console.error('Customer portal get error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, subscription_expires_at')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
    }

    return NextResponse.json({ subscription: profile })

  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const serviceSupabase = createServiceClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tier, payment_method, payment_id } = await request.json()

    if (!tier || !payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: tier, payment_method' },
        { status: 400 }
      )
    }

    // Validate tier and calculate pricing
    const tierPricing: Record<string, number> = {
      'basic': 9.99,
      'pro': 29.99,
      'premium': 99.99
    }

    if (!tierPricing[tier]) {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 })
    }

    // Calculate expiry date (30 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Update user subscription using service role
    const { data: updatedUser, error: updateError } = await serviceSupabase
      .from('users')
      .update({
        subscription_tier: tier,
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Subscription update error:', updateError)
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
    }

    // Log the payment
    await serviceSupabase
      .from('payments')
      .insert({
        user_id: user.id,
        amount: tierPricing[tier],
        currency: 'USD',
        payment_method,
        payment_id: payment_id || `manual_${Date.now()}`,
        status: 'completed',
        subscription_tier: tier
      })

    return NextResponse.json({
      message: 'Subscription updated successfully',
      subscription: {
        tier: updatedUser.subscription_tier,
        status: updatedUser.subscription_status,
        expires_at: updatedUser.subscription_expires_at
      }
    })

  } catch (error) {
    console.error('Subscription update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
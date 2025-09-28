import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { reason, immediate = false } = await request.json()
    
    // Get active subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    
    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }
    
    const now = new Date().toISOString()
    const updateData: any = {
      status: immediate ? 'cancelled' : 'pending_cancellation',
      cancellation_reason: reason || 'User requested',
      cancellation_requested_at: now
    }
    
    if (immediate) {
      updateData.cancelled_at = now
    }
    
    const { data: updatedSubscription, error } = await supabase
      .from('user_subscriptions')
      .update(updateData)
      .eq('id', subscription.id)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to cancel subscription:', error)
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at the end of current period',
      subscription: updatedSubscription
    })
    
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { reason } = await request.json()

    // Cancel the subscription
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Admin cancellation',
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
    }

    // Update user's subscription status
    if (subscription.user_id) {
      await supabase
        .from('users')
        .update({ 
          subscription_tier: 'free',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.user_id)
    }

    return NextResponse.json({
      message: 'Subscription cancelled successfully',
      subscription
    })

  } catch (error) {
    console.error('Admin subscription cancel error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
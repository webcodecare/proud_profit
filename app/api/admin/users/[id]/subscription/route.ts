import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'

interface RouteContext {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = createClient()
    const { id: userId } = context.params
    
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

    // Get target user details
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, subscription_tier, created_at')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's subscription details
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans (
          id,
          name,
          price,
          tier,
          features
        )
      `)
      .eq('user_id', userId)
      .single()

    // Get user's payment history
    const { data: paymentHistory } = await supabase
      .from('payment_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get subscription statistics
    const subscriptionStats = {
      has_subscription: !!subscription,
      is_active: subscription?.status === 'active',
      current_tier: targetUser.subscription_tier,
      subscription_start: subscription?.current_period_start,
      subscription_end: subscription?.current_period_end,
      payment_method: subscription?.payment_method,
      total_payments: paymentHistory?.length || 0,
      total_spent: paymentHistory?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0
    }

    return NextResponse.json({
      user: targetUser,
      subscription,
      payment_history: paymentHistory,
      stats: subscriptionStats
    })

  } catch (error) {
    console.error('Admin user subscription get error:', error)
    return NextResponse.json(
      { error: 'Failed to get user subscription details' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const supabase = createClient()
    const { id: userId } = context.params
    
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

    const { action, plan_id, duration_months, status } = await request.json()
    
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    let result;

    switch (action) {
      case 'update_subscription':
        const updateData: any = {}
        
        if (status) {
          updateData.status = status
        }
        
        if (plan_id) {
          updateData.plan_id = plan_id
        }
        
        if (duration_months && status === 'active') {
          const newEndDate = new Date()
          newEndDate.setMonth(newEndDate.getMonth() + duration_months)
          updateData.current_period_end = newEndDate.toISOString()
        }
        
        updateData.updated_at = new Date().toISOString()

        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            ...updateData
          }, {
            onConflict: 'user_id'
          })

        if (updateError) {
          console.error('Failed to update subscription:', updateError)
          return NextResponse.json(
            { error: 'Failed to update subscription' },
            { status: 500 }
          )
        }

        result = { message: 'Subscription updated successfully' }
        break

      case 'cancel_subscription':
        const { error: cancelError } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (cancelError) {
          console.error('Failed to cancel subscription:', cancelError)
          return NextResponse.json(
            { error: 'Failed to cancel subscription' },
            { status: 500 }
          )
        }

        result = { message: 'Subscription cancelled successfully' }
        break

      case 'extend_subscription':
        const months = duration_months || 1
        
        // Get current subscription
        const { data: currentSub } = await supabase
          .from('user_subscriptions')
          .select('current_period_end')
          .eq('user_id', userId)
          .single()

        const currentEnd = currentSub?.current_period_end ? 
          new Date(currentSub.current_period_end) : 
          new Date()
        
        const newEnd = new Date(currentEnd)
        newEnd.setMonth(newEnd.getMonth() + months)

        const { error: extendError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            current_period_end: newEnd.toISOString(),
            status: 'active',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        if (extendError) {
          console.error('Failed to extend subscription:', extendError)
          return NextResponse.json(
            { error: 'Failed to extend subscription' },
            { status: 500 }
          )
        }

        result = { 
          message: 'Subscription extended successfully',
          new_end_date: newEnd.toISOString()
        }
        break

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Admin user subscription update error:', error)
    return NextResponse.json(
      { error: 'Failed to update user subscription' },
      { status: 500 }
    )
  }
}
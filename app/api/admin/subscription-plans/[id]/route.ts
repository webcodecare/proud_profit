import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(
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

    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }

    return NextResponse.json({ plan })

  } catch (error) {
    console.error('Admin subscription plan fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const { name, price, interval, features, is_active, stripe_price_id } = await request.json()

    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (price !== undefined) updates.price = price
    if (interval !== undefined) updates.interval = interval
    if (features !== undefined) updates.features = features
    if (is_active !== undefined) updates.is_active = is_active
    if (stripe_price_id !== undefined) updates.stripe_price_id = stripe_price_id
    updates.updated_at = new Date().toISOString()

    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update subscription plan' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Subscription plan updated successfully',
      plan
    })

  } catch (error) {
    console.error('Admin subscription plan update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from('subscription_plans')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete subscription plan' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Subscription plan deactivated successfully'
    })

  } catch (error) {
    console.error('Admin subscription plan delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
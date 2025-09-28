import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

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
    
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price')
    
    if (error) {
      console.error('Failed to fetch subscription plans:', error)
      return NextResponse.json(
        { error: 'Failed to fetch subscription plans' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      plans: plans || [],
      total: plans?.length || 0
    })
    
  } catch (error) {
    console.error('Admin subscription plans API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
    
    const planData = await request.json()
    
    const { name, price, features, billing_interval } = planData
    
    if (!name || !price || !features) {
      return NextResponse.json(
        { error: 'Name, price, and features are required' },
        { status: 400 }
      )
    }
    
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .insert({
        ...planData,
        created_at: new Date().toISOString(),
        created_by: user.id
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create subscription plan:', error)
      return NextResponse.json(
        { error: 'Failed to create subscription plan' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Subscription plan created successfully',
      plan
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create subscription plan error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
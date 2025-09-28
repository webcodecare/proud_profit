import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../../../lib/supabase/server'

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

    const serviceSupabase = createServiceClient()
    
    const { data: signal, error } = await serviceSupabase
      .from('signals')
      .select(`
        *,
        notifications(count)
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
    }

    return NextResponse.json({ signal })

  } catch (error) {
    console.error('Admin signal fetch error:', error)
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

    const serviceSupabase = createServiceClient()
    const { ticker, action, price, timeframe, strategy, message, is_active } = await request.json()

    const updates: any = {}
    if (ticker !== undefined) updates.ticker = ticker.toUpperCase()
    if (action !== undefined) updates.action = action.toLowerCase()
    if (price !== undefined) updates.price = parseFloat(price)
    if (timeframe !== undefined) updates.timeframe = timeframe
    if (strategy !== undefined) updates.strategy = strategy
    if (message !== undefined) updates.message = message
    if (is_active !== undefined) updates.is_active = is_active
    updates.updated_at = new Date().toISOString()

    const { data: signal, error } = await serviceSupabase
      .from('signals')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Signal updated successfully',
      signal
    })

  } catch (error) {
    console.error('Admin signal update error:', error)
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

    const serviceSupabase = createServiceClient()

    const { error } = await serviceSupabase
      .from('signals')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete signal' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Signal deactivated successfully'
    })

  } catch (error) {
    console.error('Admin signal delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
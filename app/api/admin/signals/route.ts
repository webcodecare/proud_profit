import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'
import { requireAdminRole } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication and role
    const { error: authError, status } = await requireAdminRole(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const serviceSupabase = createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const ticker = searchParams.get('ticker')
    const action = searchParams.get('action')
    
    const offset = (page - 1) * limit

    let query = serviceSupabase
      .from('signals')
      .select(`
        *,
        notifications(count)
      `)
    
    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase())
    }
    
    if (action) {
      query = query.eq('action', action)
    }

    const { data: signals, error: queryError } = await query
      .range(offset, offset + limit - 1)
      .order('timestamp', { ascending: false })

    if (queryError) {
      console.error('Admin signals fetch error:', queryError)
      return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 })
    }

    return NextResponse.json({ signals })

  } catch (error) {
    console.error('Admin signals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication and role
    const { error: authError, status } = await requireAdminRole(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const serviceSupabase = createServiceClient()
    
    const { ticker, action, price, timeframe, strategy, message } = await request.json()

    if (!ticker || !action || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, action, price' },
        { status: 400 }
      )
    }

    const { data: signal, error: insertError } = await serviceSupabase
      .from('signals')
      .insert({
        ticker: ticker.toUpperCase(),
        action: action.toLowerCase(),
        price: parseFloat(price),
        timeframe: timeframe || '1h',
        strategy: strategy || 'manual',
        message: message || `Manual ${action} signal for ${ticker}`,
        source: 'admin_manual',
        timestamp: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Signal creation error:', insertError)
      return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 })
    }

    // Broadcast the signal
    await serviceSupabase
      .channel('signals')
      .send({
        type: 'broadcast',
        event: 'new_signal',
        payload: signal
      })

    return NextResponse.json({
      message: 'Signal created and broadcasted successfully',
      signal
    })

  } catch (error) {
    console.error('Admin signal creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check admin authentication and role
    const { error: authError, status } = await requireAdminRole(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const serviceSupabase = createServiceClient()
    
    const { id, ticker, action, price, timeframe, strategy, message, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Signal ID is required' }, { status: 400 })
    }

    const updates: any = {}
    if (ticker !== undefined) updates.ticker = ticker.toUpperCase()
    if (action !== undefined) updates.action = action.toLowerCase()
    if (price !== undefined) updates.price = parseFloat(price)
    if (timeframe !== undefined) updates.timeframe = timeframe
    if (strategy !== undefined) updates.strategy = strategy
    if (message !== undefined) updates.message = message
    if (is_active !== undefined) updates.is_active = is_active
    updates.updated_at = new Date().toISOString()

    const { data: signal, error: updateError } = await serviceSupabase
      .from('signals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Admin signal update error:', updateError)
      return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Signal updated successfully',
      signal
    })

  } catch (error) {
    console.error('Admin signal update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication and role
    const { error: authError, status } = await requireAdminRole(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const serviceSupabase = createServiceClient()
    
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Signal ID is required' }, { status: 400 })
    }

    const { error: deleteError } = await serviceSupabase
      .from('signals')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)

    if (deleteError) {
      console.error('Admin signal delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete signal' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Signal deactivated successfully'
    })

  } catch (error) {
    console.error('Admin signal delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
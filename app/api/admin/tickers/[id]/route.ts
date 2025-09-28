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

    const { data: ticker, error } = await supabase
      .from('available_tickers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
    }

    return NextResponse.json({ ticker })

  } catch (error) {
    console.error('Admin ticker fetch error:', error)
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

    const { symbol, name, is_enabled, category, priority } = await request.json()

    const updates: any = {}
    if (symbol !== undefined) updates.symbol = symbol.toUpperCase()
    if (name !== undefined) updates.name = name
    if (is_enabled !== undefined) updates.is_enabled = is_enabled
    if (category !== undefined) updates.category = category
    if (priority !== undefined) updates.priority = priority
    updates.updated_at = new Date().toISOString()

    const { data: ticker, error } = await supabase
      .from('available_tickers')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update ticker' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Ticker updated successfully',
      ticker
    })

  } catch (error) {
    console.error('Admin ticker update error:', error)
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
      .from('available_tickers')
      .update({ 
        is_enabled: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete ticker' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Ticker disabled successfully'
    })

  } catch (error) {
    console.error('Admin ticker delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
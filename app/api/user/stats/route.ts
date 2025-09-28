import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status } = await requireUserAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const supabase = createClient()

    const { data: stats, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('User stats fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 })
    }

    // Return default stats if none exist
    const defaultStats = {
      user_id: user.id,
      trades_count: 0,
      profit_loss: 0,
      win_rate: 0,
      total_signals_received: 0,
      successful_signals: 0,
      portfolio_value: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return NextResponse.json({ stats: stats || defaultStats })

  } catch (error) {
    console.error('User stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status } = await requireUserAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    const supabase = createClient()

    const updates = await request.json()

    // Validate allowed fields
    const allowedFields = [
      'trades_count', 'profit_loss', 'win_rate', 
      'total_signals_received', 'successful_signals', 'portfolio_value'
    ]
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as any)

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    filteredUpdates.updated_at = new Date().toISOString()

    const { data: stats, error } = await supabase
      .from('user_stats')
      .upsert({
        user_id: user.id,
        ...filteredUpdates
      })
      .select()
      .single()

    if (error) {
      console.error('User stats update error:', error)
      return NextResponse.json({ error: 'Failed to update user stats' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'User stats updated successfully',
      stats
    })

  } catch (error) {
    console.error('User stats update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
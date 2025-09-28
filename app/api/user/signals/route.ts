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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user's subscription tier to determine signal access
    const { data: profile } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = profile?.subscription_tier || 'free'

    // Different signal limits based on subscription
    let signalLimit = limit
    if (tier === 'free') {
      signalLimit = Math.min(limit, 5) // Free tier gets max 5 signals
    }

    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .eq('is_active', true)
      .order('timestamp', { ascending: false })
      .range(offset, offset + signalLimit - 1)

    if (error) {
      console.error('User signals fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch user signals' }, { status: 500 })
    }

    return NextResponse.json({ 
      signals: signals || [],
      total: signals?.length || 0,
      subscription_tier: tier,
      pagination: {
        limit: signalLimit,
        offset,
        has_more: (signals?.length || 0) === signalLimit
      }
    })

  } catch (error) {
    console.error('User signals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
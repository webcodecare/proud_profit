import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const ticker = searchParams.get('ticker')
    const timeframe = searchParams.get('timeframe')

    let query = supabase
      .from('signals')
      .select('*')
      .eq('is_active', true)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase())
    }

    if (timeframe) {
      query = query.eq('timeframe', timeframe)
    }

    const { data: signals, error } = await query

    if (error) {
      console.error('Signals fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 })
    }

    return NextResponse.json({ 
      signals: signals || [],
      total: signals?.length || 0
    })

  } catch (error) {
    console.error('Signals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
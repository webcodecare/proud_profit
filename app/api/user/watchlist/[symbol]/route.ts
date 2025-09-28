import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../../lib/auth-utils'

interface RouteParams {
  params: {
    symbol: string
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check user authentication
    const { user, error, status } = await requireUserAuth(request)
    if (error || !user) {
      return NextResponse.json({ error }, { status })
    }
    
    const supabase = createClient()

    const { symbol } = params

    const { error: deleteError } = await supabase
      .from('user_watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('symbol', symbol.toUpperCase())

    if (deleteError) {
      console.error('Watchlist remove error:', deleteError)
      return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Removed from watchlist successfully'
    })

  } catch (error) {
    console.error('Watchlist remove error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
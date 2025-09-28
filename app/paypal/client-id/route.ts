import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user to ensure they're authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In production, you would get this from environment variables
    const paypalClientId = process.env.PAYPAL_CLIENT_ID || 'sandbox-client-id'
    
    return NextResponse.json({
      client_id: paypalClientId,
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'
    })

  } catch (error) {
    console.error('PayPal client ID error:', error)
    return NextResponse.json(
      { error: 'Failed to get PayPal client ID' },
      { status: 500 }
    )
  }
}
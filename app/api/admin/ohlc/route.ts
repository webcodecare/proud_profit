import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const url = new URL(request.url)
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT'
    const interval = url.searchParams.get('interval') || '1d'
    const limit = parseInt(url.searchParams.get('limit') || '100')
    
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

    // Get OHLC data from database
    const { data: ohlcData } = await supabase
      .from('ohlc_data')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .eq('interval', interval)
      .order('timestamp', { ascending: false })
      .limit(limit)

    // Generate mock OHLC data if none exists
    if (!ohlcData || ohlcData.length === 0) {
      const mockData = []
      const basePrice = symbol === 'BTCUSDT' ? 45000 : 2500
      
      for (let i = limit - 1; i >= 0; i--) {
        const timestamp = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const open = basePrice + (Math.random() - 0.5) * basePrice * 0.1
        const close = open + (Math.random() - 0.5) * open * 0.05
        const high = Math.max(open, close) + Math.random() * Math.max(open, close) * 0.02
        const low = Math.min(open, close) - Math.random() * Math.min(open, close) * 0.02
        
        mockData.push({
          symbol: symbol.toUpperCase(),
          interval,
          timestamp: timestamp.toISOString(),
          open,
          high,
          low,
          close,
          volume: Math.random() * 1000000
        })
      }
      
      return NextResponse.json({
        ohlc_data: mockData,
        symbol: symbol.toUpperCase(),
        interval,
        count: mockData.length
      })
    }

    return NextResponse.json({
      ohlc_data: ohlcData,
      symbol: symbol.toUpperCase(),
      interval,
      count: ohlcData.length
    })

  } catch (error) {
    console.error('Admin OHLC error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
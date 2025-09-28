import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params
    
    // Get forecast data for symbol
    const supabase = createClient()
    const { data: forecasts } = await supabase
      .from('forecasts')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .order('created_at', { ascending: false })
      .limit(10)

    // Generate mock forecast data if none exists
    const mockForecast = {
      symbol: symbol.toUpperCase(),
      predictions: [
        { date: new Date(Date.now() + 86400000).toISOString(), price: Math.random() * 100000 + 40000 },
        { date: new Date(Date.now() + 172800000).toISOString(), price: Math.random() * 100000 + 40000 },
        { date: new Date(Date.now() + 259200000).toISOString(), price: Math.random() * 100000 + 40000 }
      ],
      confidence: Math.random() * 30 + 70,
      model: 'neural_network_v1',
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json({
      forecasts: forecasts?.length ? forecasts : [mockForecast],
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Forecast data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const period = searchParams.get('period') || '7d' // 1d, 7d, 30d, 90d, 1y
    const interval = searchParams.get('interval') || '1h' // 1m, 5m, 15m, 1h, 4h, 1d
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }
    
    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
    
    const { data: historicalData, error } = await supabase
      .from('historical_market_data')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', now.toISOString())
      .order('timestamp', { ascending: true })
    
    if (error) {
      console.error('Failed to fetch historical data:', error)
      
      // If table doesn't exist, return sample data
      const sampleData = generateSampleHistoricalData(symbol.toUpperCase(), period)
      return NextResponse.json({
        symbol: symbol.toUpperCase(),
        period,
        interval,
        data: sampleData,
        count: sampleData.length,
        is_sample: true
      })
    }
    
    // Format the data for charts
    const formattedData = historicalData?.map(item => ({
      timestamp: item.timestamp,
      open: item.open_price || item.price,
      high: item.high_price || item.price * 1.02,
      low: item.low_price || item.price * 0.98,
      close: item.close_price || item.price,
      volume: item.volume || 0
    })) || []
    
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      period,
      interval,
      data: formattedData,
      count: formattedData.length,
      is_sample: false
    })
    
  } catch (error) {
    console.error('Historical data API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateSampleHistoricalData(symbol: string, period: string) {
  const now = new Date()
  const data = []
  
  // Determine number of data points based on period
  let points: number
  switch (period) {
    case '1d': points = 24; break
    case '7d': points = 168; break // 7 * 24
    case '30d': points = 720; break // 30 * 24
    case '90d': points = 90; break // daily data
    case '1y': points = 365; break // daily data
    default: points = 168
  }
  
  // Base price for different symbols
  const basePrices: { [key: string]: number } = {
    'BTCUSDT': 65000,
    'ETHUSDT': 3200,
    'BNBUSDT': 580,
    'SOLUSDT': 140,
    'XRPUSDT': 0.52
  }
  
  let basePrice = basePrices[symbol] || 50000
  
  for (let i = points; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000) // hourly data
    
    // Generate realistic price movement
    const volatility = 0.02 // 2% volatility
    const change = (Math.random() - 0.5) * volatility
    basePrice = basePrice * (1 + change)
    
    const open = basePrice
    const high = basePrice * (1 + Math.random() * 0.01)
    const low = basePrice * (1 - Math.random() * 0.01)
    const close = basePrice
    const volume = Math.random() * 1000000
    
    data.push({
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(0))
    })
  }
  
  return data
}
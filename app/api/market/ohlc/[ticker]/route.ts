import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

interface RouteParams {
  params: {
    ticker: string
  }
}

async function fetchBinanceOHLC(symbol: string, interval: string, limit: number) {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    )
    
    if (response.ok) {
      const data = await response.json()
      return data.map((candle: any) => ({
        timestamp: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }))
    }
  } catch (error) {
    console.error(`Binance OHLC error for ${symbol}:`, error)
  }
  return null
}

async function generateMockOHLC(symbol: string, limit: number) {
  const basePrice = symbol === 'BTCUSDT' ? 65000 : 
                   symbol === 'ETHUSDT' ? 2500 : 100
  
  const ohlcData = []
  let currentPrice = basePrice
  
  for (let i = 0; i < limit; i++) {
    const variance = 0.02
    const open = currentPrice
    const change = (Math.random() - 0.5) * variance * 2
    const close = open * (1 + change)
    const high = Math.max(open, close) * (1 + Math.random() * 0.01)
    const low = Math.min(open, close) * (1 - Math.random() * 0.01)
    
    ohlcData.unshift({
      timestamp: Date.now() - (i * 60 * 1000), // 1 minute intervals
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 10000)
    })
    
    currentPrice = close
  }
  
  return ohlcData
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { ticker } = params
    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || '1m'
    const limit = parseInt(searchParams.get('limit') || '100')
    
    const symbol = ticker.toUpperCase()
    
    // Try Binance first, fallback to mock data
    let ohlcData = await fetchBinanceOHLC(symbol, interval, limit)
    if (!ohlcData) {
      ohlcData = await generateMockOHLC(symbol, limit)
    }

    // Note: OHLC caching moved to market-data-sync Edge Function
    // This endpoint is now read-only for better security

    return NextResponse.json({
      symbol,
      interval,
      data: ohlcData
    })

  } catch (error) {
    console.error('OHLC data error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch OHLC data' },
      { status: 500 }
    )
  }
}
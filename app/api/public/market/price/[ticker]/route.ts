import { NextRequest, NextResponse } from 'next/server'
import { safeLogger } from '../../../../../../lib/logger'

interface RouteParams {
  params: {
    ticker: string
  }
}

async function fetchBinancePrice(symbol: string) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
    if (response.ok) {
      const data = await response.json()
      return {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        change: parseFloat(data.priceChange),
        changePercent: parseFloat(data.priceChangePercent),
        volume: parseFloat(data.volume),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        source: 'binance',
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    safeLogger.logError('Binance API price fetch failed', error instanceof Error ? error : new Error(String(error)), { symbol, service: 'binance' })
  }
  return null
}

async function generateMockPrice(symbol: string) {
  const basePrice = symbol === 'BTCUSDT' ? 65000 : 
                   symbol === 'ETHUSDT' ? 2500 : 100
  
  const variance = 0.05
  const price = basePrice * (1 + (Math.random() - 0.5) * variance)
  const changePercent = (Math.random() - 0.5) * 10
  const change = price * (changePercent / 100)
  
  return {
    symbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    volume: Math.floor(Math.random() * 1000000),
    high: parseFloat((price * 1.05).toFixed(2)),
    low: parseFloat((price * 0.95).toFixed(2)),
    source: 'mock',
    timestamp: new Date().toISOString()
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { ticker } = params
    const symbol = ticker.toUpperCase()
    
    // Try Binance first, fallback to mock data
    let priceData = await fetchBinancePrice(symbol)
    if (!priceData) {
      priceData = await generateMockPrice(symbol)
    }

    return NextResponse.json(priceData)

  } catch (error) {
    safeLogger.logError('GET /api/public/market/price/[ticker] failed', error instanceof Error ? error : new Error(String(error)), { method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    )
  }
}
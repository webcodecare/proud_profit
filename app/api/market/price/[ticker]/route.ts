import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

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
    console.error(`Binance API error for ${symbol}:`, error)
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

    // Note: Price caching moved to market-data-sync Edge Function
    // This endpoint is now read-only for better security

    return NextResponse.json(priceData)

  } catch (error) {
    console.error('Market price error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    )
  }
}
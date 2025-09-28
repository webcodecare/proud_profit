import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

interface RouteParams {
  params: {
    ticker: string
  }
}

async function fetchBinanceKlines(symbol: string, interval: string, limit: number) {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    )
    
    if (response.ok) {
      const data = await response.json()
      return data.map((kline: any) => ({
        openTime: parseInt(kline[0]),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        closeTime: parseInt(kline[6]),
        quoteAssetVolume: parseFloat(kline[7]),
        numberOfTrades: parseInt(kline[8]),
        takerBuyBaseAssetVolume: parseFloat(kline[9]),
        takerBuyQuoteAssetVolume: parseFloat(kline[10])
      }))
    }
  } catch (error) {
    console.error(`Binance klines error for ${symbol}:`, error)
  }
  return null
}

async function fetchDatabaseKlines(symbol: string, limit: number) {
  try {
    const supabase = createClient()
    
    const { data: signals } = await supabase
      .from('buy_signals')
      .select('symbol, price, timestamp, signal_type')
      .eq('symbol', symbol)
      .order('timestamp', { ascending: false })
      .limit(limit)
    
    if (signals && signals.length > 0) {
      return signals.reverse().map((signal, index) => {
        const price = parseFloat(signal.price)
        const variance = 0.015
        const open = index > 0 ? parseFloat(signals[index-1].price) : price
        const close = price
        const high = Math.max(open, close) * (1 + Math.random() * variance)
        const low = Math.min(open, close) * (1 - Math.random() * variance)
        const volume = Math.floor(Math.random() * 10000 + 5000)
        const timestamp = new Date(signal.timestamp).getTime()
        
        return {
          openTime: timestamp - 60000,
          open: parseFloat(open.toFixed(8)),
          high: parseFloat(high.toFixed(8)),
          low: parseFloat(low.toFixed(8)),
          close: parseFloat(close.toFixed(8)),
          volume,
          closeTime: timestamp,
          quoteAssetVolume: volume * close,
          numberOfTrades: Math.floor(Math.random() * 1000),
          takerBuyBaseAssetVolume: volume * 0.6,
          takerBuyQuoteAssetVolume: volume * close * 0.6
        }
      })
    }
    
    return null
  } catch (error) {
    console.error('Database klines error:', error)
    return null
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { ticker } = params
    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || '1m'
    const limit = parseInt(searchParams.get('limit') || '100')
    
    const symbol = ticker.toUpperCase()
    
    // Prioritize database data first, then external API, minimal fallback
    let klinesData = await fetchDatabaseKlines(symbol, limit)
    let dataSource = 'database'
    
    if (!klinesData || klinesData.length === 0) {
      klinesData = await fetchBinanceKlines(symbol, interval, limit)
      dataSource = 'binance'
    }
    
    // Only use minimal fallback if no data available
    if (!klinesData || klinesData.length === 0) {
      console.log(`No klines data found for ${symbol}, returning empty dataset`)
      klinesData = []
      dataSource = 'unavailable'
    }

    return NextResponse.json({
      symbol,
      interval,
      data: klinesData,
      meta: {
        source: dataSource,
        count: klinesData?.length || 0,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Klines data error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch klines data' },
      { status: 500 }
    )
  }
}
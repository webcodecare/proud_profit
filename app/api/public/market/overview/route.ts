import { NextRequest, NextResponse } from 'next/server'
import { safeLogger } from '../../../../../lib/logger'
import { checkRateLimit } from '../../../../../lib/next-rate-limiter'

async function fetchMarketOverview() {
  try {
    // Get top cryptocurrencies from Binance
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'ATOMUSDT']
    const symbolsQuery = symbols.map(s => `"${s}"`).join(',')
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolsQuery}]`)
    
    if (response.ok) {
      const data = await response.json()
      return data.map((ticker: any) => ({
        symbol: ticker.symbol,
        name: ticker.symbol.replace('USDT', ''),
        price: parseFloat(ticker.lastPrice),
        change: parseFloat(ticker.priceChange),
        changePercent: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        high: parseFloat(ticker.highPrice),
        low: parseFloat(ticker.lowPrice),
        marketCap: parseFloat(ticker.lastPrice) * parseFloat(ticker.volume), // Simplified calculation
        source: 'binance'
      })).sort((a: any, b: any) => b.marketCap - a.marketCap)
    }
  } catch (error) {
    safeLogger.logError('Binance API market overview fetch failed', error instanceof Error ? error : new Error(String(error)), { service: 'binance' })
    throw new Error('Market data temporarily unavailable - external API service failure')
  }
  
  throw new Error('Market data unavailable - no valid data source')
}

export async function GET(request: NextRequest) {
  // Apply rate limiting for public API
  const rateLimitResponse = checkRateLimit(request, 'public')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const overview = await fetchMarketOverview()
    
    const marketStats = {
      totalMarketCap: overview.reduce((sum: number, coin: any) => sum + coin.marketCap, 0),
      totalVolume24h: overview.reduce((sum: number, coin: any) => sum + coin.volume, 0),
      btcDominance: overview.length > 0 ? (overview[0].marketCap / overview.reduce((sum: number, coin: any) => sum + coin.marketCap, 0) * 100).toFixed(2) : '0',
      activeCoins: overview.length,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      marketStats,
      topCoins: overview.slice(0, 10),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    safeLogger.logError('GET /api/public/market/overview failed', error instanceof Error ? error : new Error(String(error)), { method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch market overview' },
      { status: 500 }
    )
  }
}
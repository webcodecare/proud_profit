import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

async function fetchBinancePrices(symbols: string[]) {
  try {
    const symbolsQuery = symbols.map(s => `"${s}"`).join(',')
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolsQuery}]`)
    
    if (response.ok) {
      const data = await response.json()
      return data.map((ticker: any) => ({
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice),
        change: parseFloat(ticker.priceChange),
        changePercent: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        high: parseFloat(ticker.highPrice),
        low: parseFloat(ticker.lowPrice),
        source: 'binance',
        timestamp: new Date().toISOString()
      }))
    }
  } catch (error) {
    console.error('Binance API error:', error)
  }
  return null
}

async function fetchDatabasePrices(symbols: string[]) {
  try {
    const supabase = createClient()
    const pricesData = []
    
    for (const symbol of symbols) {
      const { data: latestSignal } = await supabase
        .from('buy_signals')
        .select('symbol, price, timestamp, signal_type')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single()
      
      if (latestSignal) {
        const price = parseFloat(latestSignal.price)
        const variance = 0.02
        const changePercent = (Math.random() - 0.5) * 5
        const change = price * (changePercent / 100)
        
        pricesData.push({
          symbol: latestSignal.symbol,
          price: price,
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          volume: Math.floor(Math.random() * 1000000 + 500000),
          high: parseFloat((price * (1 + Math.random() * variance)).toFixed(2)),
          low: parseFloat((price * (1 - Math.random() * variance)).toFixed(2)),
          source: 'database',
          timestamp: latestSignal.timestamp,
          signal_type: latestSignal.signal_type
        })
      }
    }
    
    return pricesData.length > 0 ? pricesData : null
  } catch (error) {
    console.error('Database prices error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbolsParam = searchParams.get('symbols')
    
    // If no symbols provided, return all supported symbols
    const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']

    const symbols = symbolsParam ? 
      symbolsParam.split(',').map(s => s.trim().toUpperCase()) :
      defaultSymbols
    
    // Prioritize database data first, then external API
    let pricesData = await fetchDatabasePrices(symbols)
    let dataSource = 'database'
    
    if (!pricesData || pricesData.length === 0) {
      pricesData = await fetchBinancePrices(symbols)
      dataSource = 'binance'
    }
    
    // Only minimal fallback for missing symbols
    if (!pricesData || pricesData.length < symbols.length) {
      const missingSymbols = symbols.filter(s => !pricesData?.some(p => p.symbol === s))
      if (missingSymbols.length > 0) {
        console.log(`No data found for symbols: ${missingSymbols.join(', ')}`)
        const fallbackData = missingSymbols.map(symbol => ({
          symbol, price: 0, change: 0, changePercent: 0, volume: 0,
          high: 0, low: 0, source: 'unavailable', timestamp: new Date().toISOString(),
          signal_type: null
        }))
        pricesData = [...(pricesData || []), ...fallbackData]
        dataSource = 'mixed'
      }
    }

    return NextResponse.json({
      symbols,
      data: pricesData,
      meta: {
        source: dataSource,
        timestamp: new Date().toISOString(),
        count: pricesData?.length || 0
      }
    })

  } catch (error) {
    console.error('Public market prices error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    )
  }
}
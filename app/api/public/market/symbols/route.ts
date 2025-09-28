import { NextRequest, NextResponse } from 'next/server'

const TRADING_SYMBOLS = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', name: 'Bitcoin', category: 'crypto' },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', name: 'Ethereum', category: 'crypto' },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', name: 'Binance Coin', category: 'crypto' },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', name: 'Solana', category: 'crypto' },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT', name: 'XRP', category: 'crypto' },
  { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT', name: 'Cardano', category: 'crypto' },
  { symbol: 'DOTUSDT', baseAsset: 'DOT', quoteAsset: 'USDT', name: 'Polkadot', category: 'crypto' },
  { symbol: 'MATICUSDT', baseAsset: 'MATIC', quoteAsset: 'USDT', name: 'Polygon', category: 'crypto' },
  { symbol: 'AVAXUSDT', baseAsset: 'AVAX', quoteAsset: 'USDT', name: 'Avalanche', category: 'crypto' },
  { symbol: 'ATOMUSDT', baseAsset: 'ATOM', quoteAsset: 'USDT', name: 'Cosmos', category: 'crypto' },
  { symbol: 'LINKUSDT', baseAsset: 'LINK', quoteAsset: 'USDT', name: 'Chainlink', category: 'crypto' },
  { symbol: 'LTCUSDT', baseAsset: 'LTC', quoteAsset: 'USDT', name: 'Litecoin', category: 'crypto' },
  { symbol: 'UNIUSDT', baseAsset: 'UNI', quoteAsset: 'USDT', name: 'Uniswap', category: 'crypto' },
  { symbol: 'ALGOUSDT', baseAsset: 'ALGO', quoteAsset: 'USDT', name: 'Algorand', category: 'crypto' },
  { symbol: 'VETUSDT', baseAsset: 'VET', quoteAsset: 'USDT', name: 'VeChain', category: 'crypto' }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const baseAsset = searchParams.get('baseAsset')
    const quoteAsset = searchParams.get('quoteAsset')

    let filteredSymbols = TRADING_SYMBOLS

    if (category) {
      filteredSymbols = filteredSymbols.filter(symbol => symbol.category === category)
    }

    if (baseAsset) {
      filteredSymbols = filteredSymbols.filter(symbol => symbol.baseAsset === baseAsset.toUpperCase())
    }

    if (quoteAsset) {
      filteredSymbols = filteredSymbols.filter(symbol => symbol.quoteAsset === quoteAsset.toUpperCase())
    }

    return NextResponse.json({
      symbols: filteredSymbols,
      total: filteredSymbols.length,
      categories: ['crypto'],
      quoteAssets: ['USDT'],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Market symbols error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market symbols' },
      { status: 500 }
    )
  }
}
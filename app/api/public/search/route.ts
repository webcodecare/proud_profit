import { NextRequest, NextResponse } from 'next/server'

const SEARCHABLE_ASSETS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', baseAsset: 'BTC', category: 'crypto', rank: 1 },
  { symbol: 'ETHUSDT', name: 'Ethereum', baseAsset: 'ETH', category: 'crypto', rank: 2 },
  { symbol: 'BNBUSDT', name: 'Binance Coin', baseAsset: 'BNB', category: 'crypto', rank: 3 },
  { symbol: 'SOLUSDT', name: 'Solana', baseAsset: 'SOL', category: 'crypto', rank: 4 },
  { symbol: 'XRPUSDT', name: 'XRP', baseAsset: 'XRP', category: 'crypto', rank: 5 },
  { symbol: 'ADAUSDT', name: 'Cardano', baseAsset: 'ADA', category: 'crypto', rank: 6 },
  { symbol: 'DOTUSDT', name: 'Polkadot', baseAsset: 'DOT', category: 'crypto', rank: 7 },
  { symbol: 'MATICUSDT', name: 'Polygon', baseAsset: 'MATIC', category: 'crypto', rank: 8 },
  { symbol: 'AVAXUSDT', name: 'Avalanche', baseAsset: 'AVAX', category: 'crypto', rank: 9 },
  { symbol: 'ATOMUSDT', name: 'Cosmos', baseAsset: 'ATOM', category: 'crypto', rank: 10 },
  { symbol: 'LINKUSDT', name: 'Chainlink', baseAsset: 'LINK', category: 'crypto', rank: 11 },
  { symbol: 'LTCUSDT', name: 'Litecoin', baseAsset: 'LTC', category: 'crypto', rank: 12 },
  { symbol: 'UNIUSDT', name: 'Uniswap', baseAsset: 'UNI', category: 'crypto', rank: 13 },
  { symbol: 'ALGOUSDT', name: 'Algorand', baseAsset: 'ALGO', category: 'crypto', rank: 14 },
  { symbol: 'VETUSDT', name: 'VeChain', baseAsset: 'VET', category: 'crypto', rank: 15 }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!query) {
      return NextResponse.json(
        { error: 'Search query (q) parameter is required' },
        { status: 400 }
      )
    }

    const searchTerm = query.toLowerCase()
    
    const results = SEARCHABLE_ASSETS
      .filter(asset => 
        asset.symbol.toLowerCase().includes(searchTerm) ||
        asset.name.toLowerCase().includes(searchTerm) ||
        asset.baseAsset.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => {
        // Prioritize exact matches and rank
        const aExact = a.symbol.toLowerCase() === searchTerm || a.baseAsset.toLowerCase() === searchTerm
        const bExact = b.symbol.toLowerCase() === searchTerm || b.baseAsset.toLowerCase() === searchTerm
        
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        return a.rank - b.rank
      })
      .slice(0, limit)

    return NextResponse.json({
      query,
      results,
      total: results.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Public search error:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}
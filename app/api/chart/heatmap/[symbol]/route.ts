import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    symbol: string
  }
}

function generateHeatmapData(symbol: string) {
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w']
  const indicators = ['RSI', 'MACD', 'Bollinger', 'SMA20', 'SMA50', 'Volume', 'Momentum']
  
  const heatmapData = []
  
  for (const timeframe of timeframes) {
    for (const indicator of indicators) {
      // Generate values between -1 and 1 for signal strength
      const value = (Math.random() - 0.5) * 2
      const strength = Math.abs(value)
      const signal = value > 0.3 ? 'bullish' : value < -0.3 ? 'bearish' : 'neutral'
      
      heatmapData.push({
        timeframe,
        indicator,
        value: parseFloat(value.toFixed(3)),
        strength: parseFloat(strength.toFixed(3)),
        signal,
        color: value > 0.3 ? 'green' : value < -0.3 ? 'red' : 'yellow'
      })
    }
  }
  
  return heatmapData
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol } = params
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '1h'

    const heatmapData = generateHeatmapData(symbol.toUpperCase())
    
    // Calculate overall sentiment
    const bullishCount = heatmapData.filter(d => d.signal === 'bullish').length
    const bearishCount = heatmapData.filter(d => d.signal === 'bearish').length
    const neutralCount = heatmapData.filter(d => d.signal === 'neutral').length
    
    const overallSentiment = bullishCount > bearishCount ? 'bullish' : 
                           bearishCount > bullishCount ? 'bearish' : 'neutral'

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      timeframe,
      data: heatmapData,
      summary: {
        overallSentiment,
        bullishSignals: bullishCount,
        bearishSignals: bearishCount,
        neutralSignals: neutralCount,
        totalSignals: heatmapData.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Heatmap data error:', error)
    return NextResponse.json(
      { error: 'Failed to generate heatmap data' },
      { status: 500 }
    )
  }
}
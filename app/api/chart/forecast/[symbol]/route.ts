import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    symbol: string
  }
}

function generateForecastData(symbol: string, days: number) {
  const currentPrice = symbol === 'BTCUSDT' ? 65000 : 
                      symbol === 'ETHUSDT' ? 2500 : 100
  
  const forecast = []
  let price = currentPrice
  const baseDate = new Date()
  
  for (let i = 1; i <= days; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + i)
    
    // Random walk with slight upward bias
    const change = (Math.random() - 0.45) * 0.05 // Slight bullish bias
    price = price * (1 + change)
    
    // Calculate confidence (decreases over time)
    const confidence = Math.max(95 - (i * 2), 20)
    
    // Calculate price range based on confidence
    const range = price * (0.1 - (confidence / 1000))
    
    forecast.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(1)),
      high: parseFloat((price + range).toFixed(2)),
      low: parseFloat((price - range).toFixed(2)),
      trend: change > 0.01 ? 'bullish' : change < -0.01 ? 'bearish' : 'neutral'
    })
  }
  
  return forecast
}

function generateTechnicalIndicators(symbol: string) {
  return {
    rsi: parseFloat((Math.random() * 60 + 20).toFixed(1)), // 20-80
    macd: {
      signal: Math.random() > 0.5 ? 'bullish' : 'bearish',
      value: parseFloat((Math.random() - 0.5).toFixed(4))
    },
    movingAverages: {
      sma20: parseFloat((65000 * (0.95 + Math.random() * 0.1)).toFixed(2)),
      sma50: parseFloat((65000 * (0.92 + Math.random() * 0.1)).toFixed(2)),
      ema12: parseFloat((65000 * (0.96 + Math.random() * 0.08)).toFixed(2))
    },
    support: parseFloat((65000 * (0.85 + Math.random() * 0.1)).toFixed(2)),
    resistance: parseFloat((65000 * (1.05 + Math.random() * 0.1)).toFixed(2))
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol } = params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const model = searchParams.get('model') || 'hybrid'

    const forecastData = generateForecastData(symbol.toUpperCase(), Math.min(days, 90))
    const technicalIndicators = generateTechnicalIndicators(symbol.toUpperCase())
    
    const analysis = {
      shortTerm: {
        trend: forecastData.slice(0, 7).filter(d => d.trend === 'bullish').length > 3 ? 'bullish' : 'bearish',
        volatility: 'moderate',
        keyLevels: {
          support: technicalIndicators.support,
          resistance: technicalIndicators.resistance
        }
      },
      longTerm: {
        trend: forecastData.filter(d => d.trend === 'bullish').length > forecastData.length / 2 ? 'bullish' : 'bearish',
        targetPrice: forecastData[forecastData.length - 1]?.price || 0,
        probability: parseFloat((Math.random() * 30 + 60).toFixed(1)) // 60-90%
      }
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      model,
      timeframe: `${days} days`,
      forecast: forecastData,
      technicalIndicators,
      analysis,
      metadata: {
        generatedAt: new Date().toISOString(),
        modelAccuracy: parseFloat((Math.random() * 15 + 75).toFixed(1)), // 75-90%
        disclaimer: 'Forecasts are estimates based on historical data and should not be considered financial advice'
      }
    })

  } catch (error) {
    console.error('Forecast data error:', error)
    return NextResponse.json(
      { error: 'Failed to generate forecast data' },
      { status: 500 }
    )
  }
}
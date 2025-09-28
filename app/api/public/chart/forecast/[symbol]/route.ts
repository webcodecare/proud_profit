import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    symbol: string
  }
}

function generateForecastData(symbol: string, days: number) {
  const currentPrice = symbol === 'BTCUSDT' ? 65000 : symbol === 'ETHUSDT' ? 2500 : 100
  const forecast = []
  let price = currentPrice
  const baseDate = new Date()
  
  for (let i = 1; i <= days; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + i)
    
    const change = (Math.random() - 0.45) * 0.05
    price = price * (1 + change)
    const confidence = Math.max(95 - (i * 2), 20)
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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol } = params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const forecastData = generateForecastData(symbol.toUpperCase(), Math.min(days, 90))

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      timeframe: `${days} days`,
      forecast: forecastData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Public forecast data error:', error)
    return NextResponse.json(
      { error: 'Failed to generate forecast data' },
      { status: 500 }
    )
  }
}
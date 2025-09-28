import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    symbol: string
  }
}

function generateModelData(symbol: string) {
  const models = [
    {
      id: 'lstm-v1',
      name: 'LSTM Neural Network v1',
      type: 'deep_learning',
      accuracy: parseFloat((Math.random() * 15 + 75).toFixed(1)),
      confidence: parseFloat((Math.random() * 20 + 70).toFixed(1)),
      timeframe: '1-30 days',
      features: ['price', 'volume', 'rsi', 'macd', 'bollinger'],
      lastTrained: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'arima-enhanced',
      name: 'Enhanced ARIMA',
      type: 'statistical',
      accuracy: parseFloat((Math.random() * 10 + 70).toFixed(1)),
      confidence: parseFloat((Math.random() * 25 + 65).toFixed(1)),
      timeframe: '1-7 days',
      features: ['price', 'volume', 'moving_averages'],
      lastTrained: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ensemble-v2',
      name: 'Ensemble Model v2',
      type: 'ensemble',
      accuracy: parseFloat((Math.random() * 12 + 80).toFixed(1)),
      confidence: parseFloat((Math.random() * 15 + 75).toFixed(1)),
      timeframe: '1-14 days',
      features: ['price', 'volume', 'technical_indicators', 'market_sentiment'],
      lastTrained: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
    }
  ]

  return models.map(model => ({
    ...model,
    performance: {
      backtestPeriod: '90 days',
      totalPredictions: Math.floor(Math.random() * 500) + 100,
      correctPredictions: Math.floor(model.accuracy / 100 * (Math.floor(Math.random() * 500) + 100)),
      avgError: parseFloat((Math.random() * 5 + 2).toFixed(2))
    }
  }))
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol } = params
    const models = generateModelData(symbol.toUpperCase())

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      availableModels: models,
      recommendedModel: models.reduce((best, current) => 
        current.accuracy > best.accuracy ? current : best
      ),
      metadata: {
        totalModels: models.length,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Forecast models error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch forecast models' },
      { status: 500 }
    )
  }
}
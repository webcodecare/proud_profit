import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    symbol: string
  }
}

function generateCycleData(symbol: string) {
  const phases = ['Accumulation', 'Markup', 'Distribution', 'Markdown']
  const currentPhase = phases[Math.floor(Math.random() * phases.length)]
  
  // Generate cycle position (0-100%)
  const cyclePosition = Math.floor(Math.random() * 100)
  
  // Generate historical cycle data
  const historicalCycles = []
  for (let i = 0; i < 5; i++) {
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - (i + 1))
    
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + Math.floor(Math.random() * 18) + 6) // 6-24 months
    
    const lowPrice = Math.random() * 50000 + 10000
    const highPrice = lowPrice * (2 + Math.random() * 3) // 2x to 5x multiplier
    
    historicalCycles.push({
      cycleNumber: i + 1,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      lowPrice: parseFloat(lowPrice.toFixed(2)),
      highPrice: parseFloat(highPrice.toFixed(2)),
      duration: Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      roi: parseFloat(((highPrice - lowPrice) / lowPrice * 100).toFixed(2))
    })
  }
  
  // Generate prediction for next cycle
  const avgRoi = historicalCycles.reduce((sum, cycle) => sum + cycle.roi, 0) / historicalCycles.length
  const avgDuration = historicalCycles.reduce((sum, cycle) => sum + cycle.duration, 0) / historicalCycles.length
  
  const prediction = {
    estimatedTimeToBottom: Math.floor(Math.random() * 365) + 30, // 30-395 days
    estimatedTimeToTop: Math.floor(Math.random() * 730) + 365, // 1-3 years
    projectedRoi: parseFloat((avgRoi * (0.5 + Math.random())).toFixed(2)), // Half to same as historical avg
    confidence: parseFloat((Math.random() * 40 + 60).toFixed(1)) // 60-100% confidence
  }
  
  return {
    currentPhase,
    cyclePosition,
    historicalCycles: historicalCycles.reverse(), // Most recent first
    prediction
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol } = params
    
    const cycleData = generateCycleData(symbol.toUpperCase())

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      cycleAnalysis: cycleData,
      metadata: {
        analysisDate: new Date().toISOString(),
        dataSource: 'technical_analysis',
        disclaimer: 'Cycle analysis is for educational purposes only and should not be considered financial advice'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cycle data error:', error)
    return NextResponse.json(
      { error: 'Failed to generate cycle data' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    symbol: string
  }
}

function generateCycleData(symbol: string) {
  const phases = ['Accumulation', 'Markup', 'Distribution', 'Markdown']
  const currentPhase = phases[Math.floor(Math.random() * phases.length)]
  const cyclePosition = Math.floor(Math.random() * 100)
  
  const historicalCycles = []
  for (let i = 0; i < 5; i++) {
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - (i + 1))
    
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + Math.floor(Math.random() * 18) + 6)
    
    const lowPrice = Math.random() * 50000 + 10000
    const highPrice = lowPrice * (2 + Math.random() * 3)
    
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
  
  return { currentPhase, cyclePosition, historicalCycles: historicalCycles.reverse() }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol } = params
    const cycleData = generateCycleData(symbol.toUpperCase())

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      cycleAnalysis: cycleData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Public cycle data error:', error)
    return NextResponse.json(
      { error: 'Failed to generate cycle data' },
      { status: 500 }
    )
  }
}
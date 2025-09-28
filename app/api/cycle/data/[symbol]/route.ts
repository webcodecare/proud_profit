import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params
    const supabase = createClient()
    
    // Get cycle analysis data for the symbol
    const { data: cycleData } = await supabase
      .from('cycle_analysis')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .order('created_at', { ascending: false })
      .limit(1)

    // Generate mock cycle data if none exists
    const mockCycleData = {
      symbol: symbol.toUpperCase(),
      current_phase: ['accumulation', 'markup', 'distribution', 'markdown'][Math.floor(Math.random() * 4)],
      cycle_position: Math.random() * 100,
      time_in_phase: Math.floor(Math.random() * 365) + 1,
      phase_confidence: Math.random() * 30 + 70,
      historical_cycles: [
        {
          start_date: '2020-03-01',
          end_date: '2021-11-01',
          duration_days: 610,
          phase: 'completed',
          return_percentage: 1567.5
        },
        {
          start_date: '2021-11-01',
          end_date: '2022-12-01',
          duration_days: 395,
          phase: 'completed',
          return_percentage: -76.8
        },
        {
          start_date: '2022-12-01',
          end_date: null,
          duration_days: Math.floor(Math.random() * 400) + 200,
          phase: 'current',
          return_percentage: Math.random() * 200 - 50
        }
      ],
      indicators: {
        mvrv_ratio: Math.random() * 3 + 0.5,
        realized_price: Math.random() * 50000 + 20000,
        market_value: Math.random() * 1000000000000,
        fear_greed_index: Math.floor(Math.random() * 100)
      },
      predictions: {
        next_phase: ['markup', 'distribution', 'markdown', 'accumulation'][Math.floor(Math.random() * 4)],
        estimated_duration: Math.floor(Math.random() * 180) + 30,
        confidence: Math.random() * 30 + 60
      },
      last_updated: new Date().toISOString()
    }

    return NextResponse.json({
      cycle_data: cycleData?.[0] || mockCycleData,
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cycle data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
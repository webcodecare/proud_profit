import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const interval = searchParams.get('interval') || '1h'
    const limit = parseInt(searchParams.get('limit') || '100')
    
    const supabase = createServiceClient()
    
    // Try to fetch from database first
    try {
      let query = supabase
        .from('market_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      // Filter by symbol if provided
      if (symbol) {
        query = query.eq('symbol', symbol.toUpperCase())
      }

      const { data: marketData, error } = await query

      if (error) {
        throw error
      }

      // If we have database data, return it
      if (marketData && marketData.length > 0) {
        return NextResponse.json({
          data: marketData,
          count: marketData.length,
          interval,
          timestamp: new Date().toISOString(),
          source: 'database'
        })
      }
    } catch (dbError) {
      console.log('Database query failed, falling back to sample data:', (dbError as Error).message)
    }
    
    // Fallback to sample data if database is not available
    const sampleMarketData = [
      {
        symbol: 'BTCUSDT',
        price: 65000.00,
        volume: 1500000,
        change_24h: -1200.50,
        change_percentage_24h: -1.81,
        market_cap: 1250000000000,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        high_24h: 66500.00,
        low_24h: 64000.00,
        source: 'sample'
      },
      {
        symbol: 'ETHUSDT',
        price: 2500.00,
        volume: 800000,
        change_24h: 45.20,
        change_percentage_24h: 1.84,
        market_cap: 300000000000,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        high_24h: 2550.00,
        low_24h: 2450.00,
        source: 'sample'
      },
      {
        symbol: 'SOLUSDT',
        price: 100.00,
        volume: 300000,
        change_24h: -2.10,
        change_percentage_24h: -2.05,
        market_cap: 50000000000,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        high_24h: 105.00,
        low_24h: 98.50,
        source: 'sample'
      },
      {
        symbol: 'BNBUSDT',
        price: 300.00,
        volume: 200000,
        change_24h: 5.50,
        change_percentage_24h: 1.87,
        market_cap: 45000000000,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        high_24h: 305.00,
        low_24h: 295.00,
        source: 'sample'
      },
      {
        symbol: 'XRPUSDT',
        price: 0.50,
        volume: 500000,
        change_24h: -0.02,
        change_percentage_24h: -3.85,
        market_cap: 25000000000,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        high_24h: 0.52,
        low_24h: 0.48,
        source: 'sample'
      }
    ];

    // Filter by symbol if provided
    let filteredData = sampleMarketData;
    if (symbol) {
      filteredData = sampleMarketData.filter(item => 
        item.symbol.toLowerCase() === symbol.toLowerCase()
      );
    }

    // Apply limit
    const limitedData = filteredData.slice(0, limit);
    
    return NextResponse.json({
      data: limitedData,
      count: limitedData.length,
      interval,
      timestamp: new Date().toISOString(),
      source: 'sample_fallback'
    })
    
  } catch (error) {
    console.error('Market data API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
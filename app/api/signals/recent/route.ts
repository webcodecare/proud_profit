import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    
    // Get recent signals from the last 24 hours
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    // Try different table names based on database hints
    let signals, error;
    
    try {
      // First try buy_signals (as hinted by database)
      const result = await supabase
        .from('buy_signals')
        .select('id, symbol, signal_type, notes, created_at, price, entry_price, stop_loss, take_profit, confidence, is_active')
        .eq('is_active', true)
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Transform data to expected format if successful
      if (result.data) {
        signals = result.data.map(signal => ({
          id: signal.id,
          symbol: signal.symbol,
          signal_type: signal.signal_type,
          message: signal.notes || `${signal.signal_type.toUpperCase()} signal for ${signal.symbol}`,
          timestamp: signal.created_at,
          price: signal.price || signal.entry_price,
          target_price: signal.take_profit,
          stop_loss: signal.stop_loss,
          is_active: signal.is_active,
          confidence_score: signal.confidence || 75
        }));
        error = result.error;
      } else {
        signals = [];
        error = result.error;
      }
    } catch (buySignalsError) {
      // Fallback: try signals table
      try {
        const result = await supabase
          .from('signals')
          .select('id, symbol, signal_type, message, timestamp, is_active, price, target_price, stop_loss, confidence_score')
          .eq('is_active', true)
          .gte('timestamp', twentyFourHoursAgo.toISOString())
          .order('timestamp', { ascending: false })
          .limit(50);
        
        signals = result.data;
        error = result.error;
      } catch (signalsError) {
        // Final fallback: return mock data
        signals = [];
        error = null;
      }
    }

    if (error) {
      console.error('Database error fetching recent signals:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ 
      signals: signals || [],
      timeframe: '24h',
      total: signals?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Recent signals error:', error)
    return NextResponse.json({ error: 'Failed to fetch recent signals' }, { status: 500 })
  }
}
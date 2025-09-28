import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { safeLogger } from '../../../lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Use Supabase client for secure database access
    let query = supabase
      .from('available_tickers')
      .select('symbol, is_enabled')
      .eq('is_enabled', true)
      .order('symbol')
      .range(offset, offset + limit - 1)
    
    if (search) {
      query = query.ilike('symbol', `%${search}%`)
    }
    
    // Try the tickers table
    const result = await query;
    let tickers = result.data;
    let error = result.error;
    
    // Check if available_tickers table doesn't exist (Supabase returns error in result.error, not exception)
    if (error && error.message && (error.message.includes("Could not find the table 'public.tickers'") || error.message.includes("Could not find the table 'public.available_tickers'"))) {
      console.log('Available tickers table not found, providing fallback data');
      // Provide fallback ticker data
      const fallbackTickers = [
        { symbol: 'BTCUSDT', is_enabled: true },
        { symbol: 'ETHUSDT', is_enabled: true },
        { symbol: 'SOLUSDT', is_enabled: true },
        { symbol: 'BNBUSDT', is_enabled: true },
        { symbol: 'XRPUSDT', is_enabled: true },
        { symbol: 'ADAUSDT', is_enabled: true },
        { symbol: 'DOGEUSDT', is_enabled: true },
        { symbol: 'DOTUSDT', is_enabled: true },
        { symbol: 'LINKUSDT', is_enabled: true },
        { symbol: 'UNIUSDT', is_enabled: true }
      ];
      
      let filteredTickers = fallbackTickers;
      if (search) {
        filteredTickers = fallbackTickers.filter(t => 
          t.symbol.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      tickers = filteredTickers.slice(offset, offset + limit);
      error = null; // Clear the error since we're providing fallback data
    }
    
    if (error) {
      safeLogger.logDbError('fetch_tickers', new Error(error.message), { search, limit, offset })
      return NextResponse.json(
        { error: 'Failed to fetch tickers' },
        { status: 500 }
      )
    }
    
    // Transform data to expected format
    const transformedTickers = (tickers || []).map(ticker => ({
      symbol: ticker.symbol,
      baseAsset: ticker.symbol.replace('USDT', ''),
      quoteAsset: 'USDT',
      active: ticker.is_enabled
    }))
    
    return NextResponse.json(transformedTickers)
    
  } catch (error) {
    safeLogger.logError('GET /api/tickers failed', error instanceof Error ? error : new Error(String(error)), { method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch tickers' },
      { status: 500 }
    )
  }
}
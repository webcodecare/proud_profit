import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  const { searchParams } = new URL(request.url)
  const symbols = searchParams.get('symbols')?.split(',') || ['BTCUSDT']
  
  let interval: NodeJS.Timeout

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = JSON.stringify({
        type: 'connection',
        message: 'Connected to Binance proxy stream',
        symbols,
        timestamp: new Date().toISOString()
      })
      controller.enqueue(encoder.encode(`data: ${data}\n\n`))

      // Start streaming updates every 2 seconds (faster than CoinCap)
      interval = setInterval(async () => {
        try {
          const updates = []
          
          for (const symbol of symbols) {
            const symbolUpper = symbol.toUpperCase()
            
            // Try to fetch real Binance data, fallback to mock
            let priceData
            try {
              const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbolUpper}`)
              if (response.ok) {
                const binanceData = await response.json()
                priceData = {
                  symbol: binanceData.symbol,
                  price: parseFloat(binanceData.lastPrice),
                  change: parseFloat(binanceData.priceChange),
                  changePercent: parseFloat(binanceData.priceChangePercent),
                  volume: parseFloat(binanceData.volume),
                  high: parseFloat(binanceData.highPrice),
                  low: parseFloat(binanceData.lowPrice),
                  source: 'binance'
                }
              }
            } catch (error) {
              console.error(`Binance API error for ${symbolUpper}:`, error)
            }
            
            // Fallback to mock data if Binance fails
            if (!priceData) {
              const basePrices: Record<string, number> = {
                'BTCUSDT': 65000,
                'ETHUSDT': 2500,
                'BNBUSDT': 300,
                'SOLUSDT': 100,
                'XRPUSDT': 0.5
              }
              
              const basePrice = basePrices[symbolUpper] || 100
              const variance = 0.002 // 0.2% variance for more movement
              const price = basePrice * (1 + (Math.random() - 0.5) * variance)
              const changePercent = (Math.random() - 0.5) * 3 // -1.5% to +1.5%
              
              priceData = {
                symbol: symbolUpper,
                price: parseFloat(price.toFixed(2)),
                change: parseFloat((price * (changePercent / 100)).toFixed(2)),
                changePercent: parseFloat(changePercent.toFixed(2)),
                volume: Math.floor(Math.random() * 2000000),
                high: parseFloat((price * 1.02).toFixed(2)),
                low: parseFloat((price * 0.98).toFixed(2)),
                source: 'mock'
              }
            }
            
            updates.push({
              ...priceData,
              timestamp: new Date().toISOString()
            })
          }

          const streamData = JSON.stringify({
            type: 'ticker_update',
            data: updates,
            source: 'binance_proxy',
            timestamp: new Date().toISOString()
          })

          controller.enqueue(encoder.encode(`data: ${streamData}\n\n`))
        } catch (error) {
          console.error('Binance proxy stream error:', error)
          const errorData = JSON.stringify({
            type: 'error',
            message: 'Binance proxy stream error',
            timestamp: new Date().toISOString()
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        }
      }, 2000)
    },
    
    cancel() {
      if (interval) {
        clearInterval(interval)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  let interval: NodeJS.Timeout

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = JSON.stringify({
        type: 'connection',
        message: 'Connected to CoinCap price stream',
        timestamp: new Date().toISOString()
      })
      controller.enqueue(encoder.encode(`data: ${data}\n\n`))

      // Start streaming price updates every 5 seconds
      interval = setInterval(() => {
        try {
          // Generate mock price data for multiple cryptocurrencies
          const coins = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']
          const basePrices: Record<string, number> = {
            'BTCUSDT': 65000,
            'ETHUSDT': 2500, 
            'BNBUSDT': 300,
            'SOLUSDT': 100,
            'XRPUSDT': 0.5
          }
          
          const updates = coins.map(symbol => {
            const basePrice = basePrices[symbol] || 100
            const variance = 0.001 // 0.1% variance
            const price = basePrice * (1 + (Math.random() - 0.5) * variance)
            const changePercent = (Math.random() - 0.5) * 2 // -1% to +1%
            
            return {
              symbol,
              price: parseFloat(price.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              volume: Math.floor(Math.random() * 1000000),
              timestamp: new Date().toISOString()
            }
          })

          const streamData = JSON.stringify({
            type: 'price_update',
            data: updates,
            source: 'coincap_stream',
            timestamp: new Date().toISOString()
          })

          controller.enqueue(encoder.encode(`data: ${streamData}\n\n`))
        } catch (error) {
          console.error('Stream error:', error)
          const errorData = JSON.stringify({
            type: 'error',
            message: 'Stream error occurred',
            timestamp: new Date().toISOString()
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        }
      }, 5000)
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
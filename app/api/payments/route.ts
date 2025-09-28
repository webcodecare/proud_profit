import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    
    let query = supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: payments, error } = await query
    
    if (error) {
      console.error('Failed to fetch payments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch payments' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      payments: payments || [],
      pagination: {
        limit,
        offset,
        hasMore: (payments?.length || 0) === limit
      }
    })
    
  } catch (error) {
    console.error('Payments API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { amount, currency = 'USD', description, payment_method = 'stripe' } = await request.json()
    
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      )
    }
    
    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const paymentData = {
      payment_id: paymentId,
      user_id: user.id,
      amount: parseFloat(amount),
      currency,
      description: description || 'Payment',
      payment_method,
      status: 'pending',
      created_at: new Date().toISOString()
    }
    
    const { data: payment, error } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create payment:', error)
      return NextResponse.json(
        { error: 'Failed to create payment' },
        { status: 500 }
      )
    }
    
    // Simulate payment processing
    setTimeout(async () => {
      const success = Math.random() > 0.1 // 90% success rate
      await supabase
        .from('payments')
        .update({
          status: success ? 'completed' : 'failed',
          processed_at: new Date().toISOString(),
          failure_reason: success ? null : 'Simulated payment failure'
        })
        .eq('id', payment.id)
    }, 2000)
    
    return NextResponse.json({
      message: 'Payment initiated',
      payment: {
        id: payment.payment_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status
      }
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
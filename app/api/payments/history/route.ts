import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const offset = (page - 1) * limit

    let query = supabase
      .from('payments')
      .select(`
        *,
        subscription_plans!inner(name, price, interval)
      `)
      .eq('user_id', user.id)

    if (status) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: payments, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Payment history fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch payment history' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Calculate summary statistics
    const { data: stats } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('user_id', user.id)

    const summary = {
      totalPayments: count || 0,
      totalAmount: stats?.reduce((sum, payment) => 
        payment.status === 'completed' ? sum + payment.amount : sum, 0
      ) || 0,
      successfulPayments: stats?.filter(p => p.status === 'completed').length || 0,
      failedPayments: stats?.filter(p => p.status === 'failed').length || 0,
      pendingPayments: stats?.filter(p => p.status === 'pending').length || 0
    }

    return NextResponse.json({
      payments: payments || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary
    })

  } catch (error) {
    console.error('Payment history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
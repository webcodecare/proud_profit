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
    const status = searchParams.get('status') // open, in_progress, resolved, closed
    
    let query = supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: tickets, error } = await query
    
    if (error) {
      console.error('Failed to fetch support tickets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch support tickets' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      tickets: tickets || [],
      pagination: {
        limit,
        offset,
        hasMore: (tickets?.length || 0) === limit
      }
    })
    
  } catch (error) {
    console.error('Support tickets API error:', error)
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
    
    const { subject, message, priority = 'normal', category = 'general' } = await request.json()
    
    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      )
    }
    
    const ticketId = `TKT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const ticketData = {
      ticket_id: ticketId,
      user_id: user.id,
      subject,
      message,
      priority,
      category,
      status: 'open',
      created_at: new Date().toISOString()
    }
    
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert(ticketData)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create support ticket:', error)
      return NextResponse.json(
        { error: 'Failed to create support ticket' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Support ticket created successfully',
      ticket
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create support ticket error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
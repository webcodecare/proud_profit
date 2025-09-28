import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { data: reports, error } = await supabase
      .from('admin_reports')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Failed to fetch reports:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      reports: reports || [],
      total: reports?.length || 0
    })
    
  } catch (error) {
    console.error('Admin reports API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user and verify admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { report_type, title, description, filters } = await request.json()
    
    if (!report_type || !title) {
      return NextResponse.json(
        { error: 'Report type and title are required' },
        { status: 400 }
      )
    }
    
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const reportData = {
      report_id: reportId,
      report_type,
      title,
      description: description || '',
      filters: filters || {},
      status: 'pending',
      created_by: user.id,
      created_at: new Date().toISOString()
    }
    
    const { data: report, error } = await supabase
      .from('admin_reports')
      .insert(reportData)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create report:', error)
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Report created successfully',
      report: report
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
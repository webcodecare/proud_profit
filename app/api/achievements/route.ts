import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    
    // Fetch achievements from the database
    const { data: achievements, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('points', { ascending: false })

    if (error) {
      console.error('Failed to fetch achievements:', error)
      return NextResponse.json(
        { error: 'Failed to fetch achievements' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      achievements: achievements || [],
      total: achievements?.length || 0
    })
    
  } catch (error) {
    console.error('Achievements API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    
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
    
    const achievementData = await request.json()
    
    const { data: achievement, error } = await supabase
      .from('achievements')
      .insert({
        ...achievementData,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create achievement:', error)
      return NextResponse.json(
        { error: 'Failed to create achievement' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Achievement created successfully',
      achievement
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create achievement error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
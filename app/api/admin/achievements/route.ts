import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get all achievements
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .order('created_at', { ascending: false })

    // Get achievement statistics
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select(`
        achievement_id,
        users (id),
        achievements (name, type)
      `)

    const stats = userAchievements?.reduce((acc: Record<string, number>, ua) => {
      acc[ua.achievement_id] = (acc[ua.achievement_id] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const achievementsWithStats = achievements?.map(achievement => ({
      ...achievement,
      user_count: stats[achievement.id] || 0
    }))

    return NextResponse.json({
      achievements: achievementsWithStats || [],
      total_achievements: achievements?.length || 0,
      total_awarded: userAchievements?.length || 0
    })

  } catch (error) {
    console.error('Admin achievements error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { name, description, type, criteria, icon, points } = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Create new achievement
    const { data: achievement, error } = await supabase
      .from('achievements')
      .insert({
        name,
        description,
        type: type || 'trading',
        criteria: criteria || {},
        icon: icon || '🏆',
        points: points || 10,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ achievement })

  } catch (error) {
    console.error('Create achievement error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
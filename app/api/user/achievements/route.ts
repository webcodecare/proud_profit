import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error, status } = await requireUserAuth(request)
    if (error || !user) {
      return NextResponse.json({ error }, { status })
    }
    
    const supabase = createClient()

    // Get all achievements and user's unlocked status
    const { data: allAchievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (achievementsError) {
      console.error('Achievements fetch error:', achievementsError)
      return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
    }

    // Get user's unlocked achievements
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked, unlocked_at')
      .eq('user_id', user.id)

    if (userAchievementsError) {
      console.error('User achievements fetch error:', userAchievementsError)
      return NextResponse.json({ error: 'Failed to fetch user achievements' }, { status: 500 })
    }

    // Create a map of unlocked achievements
    const unlockedMap = new Map()
    userAchievements?.forEach(ua => {
      unlockedMap.set(ua.achievement_id, {
        unlocked: ua.unlocked,
        unlocked_at: ua.unlocked_at
      })
    })

    // Combine achievements with user unlock status
    const formattedAchievements = allAchievements?.map(achievement => {
      const userStatus = unlockedMap.get(achievement.id)
      return {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        rarity: achievement.rarity,
        points: achievement.points,
        unlocked: userStatus?.unlocked || false,
        unlocked_at: userStatus?.unlocked_at || null
      }
    }) || []

    return NextResponse.json({ achievements: formattedAchievements })

  } catch (error) {
    console.error('Achievements fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
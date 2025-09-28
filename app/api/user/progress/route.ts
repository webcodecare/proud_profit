import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error: authError, status, supabase } = await requireUserAuth(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status })
    }
    
    if (!user || !supabase) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Get user progress from database
    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (progressError || !progress) {
      // Initialize progress if it doesn't exist
      const { error: initError } = await supabase.rpc('initialize_user_progress', { user_uuid: user.id })
      
      if (initError) {
        console.error('Progress initialization error:', initError)
        return NextResponse.json({ error: 'Failed to initialize user progress' }, { status: 500 })
      }
      
      // Fetch again after initialization
      const { data: newProgress, error: newProgressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()
        
      if (newProgressError) {
        console.error('Progress initialization error:', newProgressError)
        return NextResponse.json({ error: 'Failed to initialize progress' }, { status: 500 })
      }
      
      // Get next milestone
      const { data: nextMilestones } = await supabase
        .from('user_milestones')
        .select(`
          current,
          milestones(
            name,
            description,
            target,
            type
          )
        `)
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('created_at', { ascending: true })
        .limit(1)

      const nextMilestone = nextMilestones?.[0]

      return NextResponse.json({ 
        progress: {
          ...newProgress,
          next_milestone: nextMilestone ? {
            name: (nextMilestone.milestones as any)?.name,
            description: (nextMilestone.milestones as any)?.description,
            target: (nextMilestone.milestones as any)?.target,
            current: nextMilestone.current,
            type: (nextMilestone.milestones as any)?.type
          } : null
        }
      })
    }

    // Get next milestone for existing progress
    const { data: nextMilestones } = await supabase
      .from('user_milestones')
      .select(`
        current,
        milestones(
          name,
          description,
          target,
          type
        )
      `)
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('created_at', { ascending: true })
      .limit(1)

    const nextMilestone = nextMilestones?.[0]

    return NextResponse.json({ 
      progress: {
        ...progress,
        next_milestone: nextMilestone ? {
          name: (nextMilestone.milestones as any)?.name,
          description: (nextMilestone.milestones as any)?.description,
          target: (nextMilestone.milestones as any)?.target,
          current: nextMilestone.current,
          type: (nextMilestone.milestones as any)?.type
        } : null
      }
    })

  } catch (error) {
    console.error('Progress fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
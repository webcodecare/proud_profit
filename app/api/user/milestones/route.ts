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

    // Get user milestones from database
    const { data: userMilestones, error: milestonesError } = await supabase
      .from('user_milestones')
      .select(`
        id,
        current,
        completed,
        completed_at,
        milestones(
          id,
          name,
          description,
          category,
          target,
          reward_points,
          type
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (milestonesError || !userMilestones?.length) {
      // Initialize milestones if they don't exist or user has no milestones
      const { error: initError } = await supabase.rpc('initialize_user_progress', { user_uuid: user.id })
      
      if (initError) {
        console.error('Milestones initialization error:', initError)
        return NextResponse.json({ error: 'Failed to initialize user milestones' }, { status: 500 })
      }
      
      // Fetch again after initialization
      const { data: newUserMilestones, error: newMilestonesError } = await supabase
        .from('user_milestones')
        .select(`
          id,
          current,
          completed,
          completed_at,
          milestones(
            id,
            name,
            description,
            category,
            target,
            reward_points,
            type
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        
      if (newMilestonesError) {
        console.error('Milestones initialization error:', newMilestonesError)
        return NextResponse.json({ error: 'Failed to initialize milestones' }, { status: 500 })
      }
      
      const formattedMilestones = newUserMilestones?.map(um => ({
        id: (um.milestones as any)?.id,
        name: (um.milestones as any)?.name,
        description: (um.milestones as any)?.description,
        category: (um.milestones as any)?.category,
        target: (um.milestones as any)?.target,
        current: um.current,
        completed: um.completed,
        completed_at: um.completed_at,
        reward_points: (um.milestones as any)?.reward_points
      })) || []
      
      return NextResponse.json({ milestones: formattedMilestones })
    }

    const formattedMilestones = userMilestones?.map(um => ({
      id: (um.milestones as any)?.id,
      name: (um.milestones as any)?.name,
      description: (um.milestones as any)?.description,
      category: (um.milestones as any)?.category,
      target: (um.milestones as any)?.target,
      current: um.current,
      completed: um.completed,
      completed_at: um.completed_at,
      reward_points: (um.milestones as any)?.reward_points
    })) || []

    return NextResponse.json({ milestones: formattedMilestones })

  } catch (error) {
    console.error('Milestones fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
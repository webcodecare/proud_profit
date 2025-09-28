import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get smart timing analytics for the user
    const { data: interactions, error } = await supabase
      .from('smart_timing_interactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) {
      console.error('Failed to fetch smart timing data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      )
    }
    
    // Analyze user behavior patterns
    const analytics = {
      total_interactions: interactions?.length || 0,
      engagement_score: 0,
      preferred_times: [] as Array<{ hour: number; count: number }>,
      response_patterns: {} as any,
      recommendations: [] as string[]
    }
    
    if (interactions && interactions.length > 0) {
      // Calculate engagement score (simplified)
      const positiveInteractions = interactions.filter(i => i.action === 'clicked' || i.action === 'viewed')
      analytics.engagement_score = Math.round((positiveInteractions.length / interactions.length) * 100)
      
      // Analyze preferred times
      const hourCounts: { [key: number]: number } = {}
      interactions.forEach(interaction => {
        const hour = new Date(interaction.created_at).getHours()
        hourCounts[hour] = (hourCounts[hour] || 0) + 1
      })
      
      // Get top 3 preferred hours
      analytics.preferred_times = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      
      // Response patterns
      analytics.response_patterns = {
        immediate_response: interactions.filter(i => i.response_time && i.response_time < 5).length,
        delayed_response: interactions.filter(i => i.response_time && i.response_time >= 5).length,
        no_response: interactions.filter(i => !i.response_time).length
      }
      
      // Generate recommendations
      if (analytics.engagement_score > 70) {
        analytics.recommendations.push('High engagement detected - consider premium features')
      }
      if (analytics.preferred_times.length > 0) {
        const topHour = analytics.preferred_times[0].hour
        analytics.recommendations.push(`Optimal notification time: ${topHour}:00 - ${topHour + 1}:00`)
      }
    }
    
    return NextResponse.json({
      analytics,
      last_updated: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Smart timing analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
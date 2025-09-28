import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

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
    
    // Get pending notifications
    const { data: pendingNotifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at')
      .limit(50)
    
    if (error) {
      console.error('Failed to fetch pending notifications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch pending notifications' },
        { status: 500 }
      )
    }
    
    let processedCount = 0
    let errors = []
    
    // Process each notification
    for (const notification of pendingNotifications || []) {
      try {
        // Simulate processing (in real implementation, send actual notifications)
        const success = Math.random() > 0.1 // 90% success rate for demo
        
        const updateData: any = {
          status: success ? 'sent' : 'failed',
          processed_at: new Date().toISOString(),
          attempts: (notification.attempts || 0) + 1
        }
        
        if (!success) {
          updateData.error_message = 'Simulated processing error'
        }
        
        const { error: updateError } = await supabase
          .from('notification_queue')
          .update(updateData)
          .eq('id', notification.id)
        
        if (updateError) {
          errors.push(`Failed to update notification ${notification.id}: ${updateError.message}`)
        } else {
          processedCount++
        }
        
      } catch (processError) {
        errors.push(`Processing error for notification ${notification.id}: ${processError instanceof Error ? processError.message : 'Unknown error'}`)
      }
    }
    
    return NextResponse.json({
      message: 'Force processing completed',
      processed_count: processedCount,
      total_pending: pendingNotifications?.length || 0,
      errors_count: errors.length,
      errors: errors.slice(0, 5) // Show first 5 errors
    })
    
  } catch (error) {
    console.error('Force process error:', error)
    return NextResponse.json(
      { error: 'Failed to force process notifications' },
      { status: 500 }
    )
  }
}
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get pending notifications that need to be sent
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        users!inner(
          email,
          phone,
          notification_preferences
        )
      `)
      .eq('is_sent', false)
      .lte('scheduled_for', new Date().toISOString())
      .limit(100)

    if (error) {
      console.error('Failed to fetch notifications:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notifications' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let processedCount = 0
    let failedCount = 0

    for (const notification of notifications) {
      try {
        const channels = notification.channels || ['app']
        let sent = false

        // Process each notification channel
        for (const channel of channels) {
          switch (channel) {
            case 'email':
              if (notification.users.email && notification.users.notification_preferences?.email_enabled) {
                // In a real implementation, you would integrate with SendGrid, AWS SES, etc.
                console.log(`Would send email to ${notification.users.email}: ${notification.title}`)
                sent = true
              }
              break

            case 'sms':
              if (notification.users.phone && notification.users.notification_preferences?.sms_enabled) {
                // In a real implementation, you would integrate with Twilio, AWS SNS, etc.
                console.log(`Would send SMS to ${notification.users.phone}: ${notification.title}`)
                sent = true
              }
              break

            case 'app':
              // App notifications are handled via real-time subscriptions
              const userChannel = supabase.channel(`user_${notification.user_id}`)
              
              try {
                const subscribeStatus = await userChannel.subscribe()
                
                if (subscribeStatus === 'SUBSCRIBED') {
                  const notificationResult = await userChannel.send({
                    type: 'broadcast',
                    event: 'notification',
                    payload: {
                      id: notification.id,
                      title: notification.title,
                      message: notification.message,
                      type: notification.type,
                      timestamp: new Date().toISOString()
                    }
                  })

                  if (notificationResult === 'ok') {
                    sent = true
                  } else {
                    console.error(`Failed to broadcast notification ${notification.id}: ${notificationResult}`)
                    sent = false
                  }
                } else {
                  console.error(`Failed to subscribe to user channel: ${subscribeStatus}`)
                  sent = false
                }
              } catch (error) {
                console.error(`Notification broadcast error for user ${notification.user_id}:`, error)
                sent = false
              } finally {
                // Cleanup channel to prevent connection leaks
                await userChannel.unsubscribe()
                supabase.removeChannel(userChannel)
              }
              break
          }
        }

        // Mark notification as sent
        if (sent) {
          await supabase
            .from('notifications')
            .update({
              is_sent: true,
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id)

          processedCount++
        }

      } catch (notificationError) {
        console.error(`Failed to process notification ${notification.id}:`, notificationError)
        failedCount++
      }
    }

    // Clean up old notifications (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    await supabase
      .from('notifications')
      .delete()
      .eq('is_sent', true)
      .lt('sent_at', thirtyDaysAgo.toISOString())

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notifications processed successfully',
        processed: processedCount,
        failed: failedCount,
        total: notifications.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Scheduled notifications error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
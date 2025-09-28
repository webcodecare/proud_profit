import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phone_number, verification_code } = await request.json()
    
    if (!phone_number) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    if (!verification_code) {
      // Send verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      
      // Store verification code in database
      const { error: storeError } = await supabase
        .from('sms_verifications')
        .upsert({
          user_id: user.id,
          phone_number,
          verification_code: code,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (storeError) {
        console.error('Failed to store verification code:', storeError)
        return NextResponse.json(
          { error: 'Failed to send verification code' },
          { status: 500 }
        )
      }

      // In production, send SMS via Twilio or similar service
      // For now, return success (code would be sent via SMS)
      console.log(`SMS verification code for ${phone_number}: ${code}`)

      return NextResponse.json({
        message: 'Verification code sent successfully',
        phone_number: phone_number.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
        expires_in: 600 // 10 minutes
      })
    } else {
      // Verify the code
      const { data: verification, error: verifyError } = await supabase
        .from('sms_verifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('phone_number', phone_number)
        .eq('verification_code', verification_code)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (verifyError || !verification) {
        return NextResponse.json({ 
          error: 'Invalid or expired verification code' 
        }, { status: 400 })
      }

      // Mark phone number as verified
      const { error: updateUserError } = await supabase
        .from('users')
        .update({
          phone_number,
          phone_verified: true,
          phone_verified_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateUserError) {
        console.error('Failed to update user phone verification:', updateUserError)
        return NextResponse.json(
          { error: 'Failed to verify phone number' },
          { status: 500 }
        )
      }

      // Clean up verification record
      await supabase
        .from('sms_verifications')
        .delete()
        .eq('user_id', user.id)

      return NextResponse.json({
        message: 'Phone number verified successfully',
        phone_number: phone_number.replace(/\d(?=\d{4})/g, '*'),
        verified_at: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('SMS verification error:', error)
    return NextResponse.json(
      { error: 'Failed to process SMS verification' },
      { status: 500 }
    )
  }
}
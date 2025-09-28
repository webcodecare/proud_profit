import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { promo_code } = await request.json()
    
    if (!promo_code) {
      return NextResponse.json(
        { error: 'Promo code is required' },
        { status: 400 }
      )
    }

    // Get promo code details
    const { data: promoCode, error: promoError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promo_code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (promoError || !promoCode) {
      return NextResponse.json({ 
        error: 'Invalid or expired promo code' 
      }, { status: 400 })
    }

    // Check if promo code is still valid
    const now = new Date()
    if (promoCode.expires_at && new Date(promoCode.expires_at) < now) {
      return NextResponse.json({ 
        error: 'Promo code has expired' 
      }, { status: 400 })
    }

    // Check usage limits
    if (promoCode.usage_limit && promoCode.used_count >= promoCode.usage_limit) {
      return NextResponse.json({ 
        error: 'Promo code usage limit exceeded' 
      }, { status: 400 })
    }

    // Check if user has already used this promo code
    const { data: existingUsage } = await supabase
      .from('promo_code_usage')
      .select('id')
      .eq('user_id', user.id)
      .eq('promo_code_id', promoCode.id)
      .single()

    if (existingUsage) {
      return NextResponse.json({ 
        error: 'You have already used this promo code' 
      }, { status: 400 })
    }

    // Apply the promo code
    let discountedPrice = 0
    let discountAmount = 0

    if (promoCode.discount_type === 'percentage') {
      discountAmount = (promoCode.original_price * promoCode.discount_value) / 100
      discountedPrice = promoCode.original_price - discountAmount
    } else if (promoCode.discount_type === 'fixed') {
      discountAmount = promoCode.discount_value
      discountedPrice = Math.max(0, promoCode.original_price - discountAmount)
    }

    // Record promo code usage
    const { error: usageError } = await supabase
      .from('promo_code_usage')
      .insert({
        user_id: user.id,
        promo_code_id: promoCode.id,
        discount_amount: discountAmount,
        original_price: promoCode.original_price,
        final_price: discountedPrice,
        created_at: new Date().toISOString()
      })

    if (usageError) {
      console.error('Failed to record promo code usage:', usageError)
      return NextResponse.json(
        { error: 'Failed to apply promo code' },
        { status: 500 }
      )
    }

    // Update promo code usage count
    const { error: updateError } = await supabase
      .from('promo_codes')
      .update({
        used_count: promoCode.used_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', promoCode.id)

    if (updateError) {
      console.error('Failed to update promo code usage count:', updateError)
      // Don't fail the request for this
    }

    return NextResponse.json({
      message: 'Promo code applied successfully',
      promo_code: {
        code: promoCode.code,
        description: promoCode.description,
        discount_type: promoCode.discount_type,
        discount_value: promoCode.discount_value
      },
      pricing: {
        original_price: promoCode.original_price,
        discount_amount: discountAmount,
        final_price: discountedPrice,
        savings: discountAmount
      },
      valid_until: promoCode.expires_at,
      applied_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Apply promo code error:', error)
    return NextResponse.json(
      { error: 'Failed to apply promo code' },
      { status: 500 }
    )
  }
}
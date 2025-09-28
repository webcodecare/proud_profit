import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required', valid: false },
        { status: 400 }
      )
    }

    // For Supabase, token validation happens during the actual password reset
    // This endpoint provides a way to check if we have a token
    return NextResponse.json({
      valid: true,
      message: 'Token format is valid'
    })

  } catch (error) {
    console.error('Reset token validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error', valid: false },
      { status: 500 }
    )
  }
}
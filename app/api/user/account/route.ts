import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '../../../../lib/supabase/server'
import { requireUserAuth } from '../../../../lib/auth-utils'

export async function DELETE(request: NextRequest) {
  try {
    // Check user authentication
    const { user, error, status } = await requireUserAuth(request)
    if (error || !user) {
      return NextResponse.json({ error }, { status })
    }
    
    const supabase = createClient()
    const serviceSupabase = createServiceClient()

    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ error: 'Password is required to delete account' }, { status: 400 })
    }

    // Verify password by attempting to sign in
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email || '',
      password
    })

    if (passwordError) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Delete user data (cascading deletes should handle related records)
    const { error: deleteError } = await serviceSupabase
      .from('users')
      .delete()
      .eq('id', user.id)

    if (deleteError) {
      console.error('User data deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete user data' }, { status: 500 })
    }

    // Delete from auth
    const { error: authDeleteError } = await serviceSupabase.auth.admin.deleteUser(user.id)

    if (authDeleteError) {
      console.error('Auth user deletion error:', authDeleteError)
      return NextResponse.json({ error: 'Failed to delete user account' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Account deleted successfully'
    })

  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from './supabase/server'

export async function authenticateUser(request: NextRequest) {
  // Try Bearer token first (for API testing)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    // Use service client to verify the JWT token
    const serviceClient = createServiceClient()
    const { data: { user }, error } = await serviceClient.auth.getUser(token)
    
    if (!error && user) {
      return { user, error: null }
    }
  }
  
  // Fallback to cookie-based authentication
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  return { user: data?.user ?? null, error }
}

export async function requireAdminRole(request: NextRequest) {
  // Get authenticated user
  const { user, error: authError } = await authenticateUser(request)
  
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401, user: null }
  }
  
  // Check admin role using service client
  const serviceClient = createServiceClient()
  let { data: profile } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  
  // Fallback to email if ID lookup fails
  if (!profile && user.email) {
    const { data: profileByEmail } = await serviceClient
      .from('users')
      .select('role')
      .eq('email', user.email)
      .single()
    profile = profileByEmail
  }
  
  if (!profile || profile.role !== 'admin') {
    return { error: 'Admin access required', status: 403, user: null }
  }
  
  return { error: null, status: 200, user }
}

export async function requireUserAuth(request: NextRequest) {
  // Get authenticated user
  const { user, error: authError } = await authenticateUser(request)
  
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401, user: null, supabase: null }
  }
  
  // Create appropriate Supabase client based on auth method
  let supabase
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    // For Bearer token, use service client with proper auth header
    supabase = createServiceClient()
  } else {
    // For cookie auth, use regular client
    supabase = createClient()
  }
  
  return { error: null, status: 200, user, supabase }
}
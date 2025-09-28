import { createClient } from '@supabase/supabase-js'
import logger, { perfLogger } from './logger'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required')
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
}

// Create Supabase client for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Secure typed query helpers - NO RAW SQL
class DatabaseService {
  // Users operations
  async getUser(id: string) {
    const timer = perfLogger.startTimer('db.getUser')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      timer.end({ userId: id })
      return data
    } catch (error) {
      timer.end({ userId: id, error: true })
      logger.error('Database error in getUser', { error, userId: id })
      throw error
    }
  }

  async getUserByEmail(email: string) {
    const timer = perfLogger.startTimer('db.getUserByEmail')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      timer.end({ found: !!data })
      return data
    } catch (error) {
      timer.end({ error: true })
      logger.error('Database error in getUserByEmail', { error })
      throw error
    }
  }

  async createUser(userData: any) {
    const timer = perfLogger.startTimer('db.createUser')
    try {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single()
      
      if (error) throw error
      timer.end({ userId: data.id })
      logger.info('User created', { userId: data.id })
      return data
    } catch (error) {
      timer.end({ error: true })
      logger.error('Database error in createUser', { error })
      throw error
    }
  }

  async updateUser(id: string, updates: any) {
    const timer = perfLogger.startTimer('db.updateUser')
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      timer.end({ userId: id })
      logger.info('User updated', { userId: id })
      return data
    } catch (error) {
      timer.end({ userId: id, error: true })
      logger.error('Database error in updateUser', { error, userId: id })
      throw error
    }
  }

  // SECURITY: Legacy SQL methods removed to prevent injection attacks
  // Use the specific typed methods above instead
}

// SECURITY: Removed vulnerable SQL parsing functions
// All database operations now use Supabase's secure parameterized queries

// Create and export database service instance
const db = new DatabaseService()

export {
  supabase,
  db
}

export default db
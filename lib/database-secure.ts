import { createClient } from '@supabase/supabase-js'

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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }

  async getUserByEmail(email: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async createUser(userData: any) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateUser(id: string, updates: any) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Tickers operations
  async getTickers(isActive = true) {
    const { data, error } = await supabase
      .from('available_tickers')
      .select('*')
      .eq('is_enabled', isActive)
      .order('symbol')
    
    if (error) throw error
    return data || []
  }

  async getTicker(symbol: string) {
    const { data, error } = await supabase
      .from('available_tickers')
      .select('*')
      .eq('symbol', symbol)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  // Market data operations
  async getMarketPrice(symbol: string) {
    const { data, error } = await supabase
      .from('market_prices')
      .select('*')
      .eq('symbol', symbol)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async updateMarketPrice(symbol: string, priceData: any) {
    const { data, error } = await supabase
      .from('market_prices')
      .upsert({ symbol, ...priceData, updated_at: new Date().toISOString() })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async getOHLCData(symbol: string, interval = '1d', limit = 100) {
    const { data, error } = await supabase
      .from('ohlc_data')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', interval)
      .order('timestamp', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  }

  // Signals operations
  async getSignals(ticker?: string, timeframe?: string, limit = 50) {
    let query = supabase
      .from('signals')
      .select('*')
      .eq('is_active', true)
      .order('timestamp', { ascending: false })
      .limit(limit)
    
    if (ticker) {
      query = query.eq('ticker', ticker)
    }
    
    if (timeframe) {
      query = query.eq('timeframe', timeframe)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async createSignal(signalData: any) {
    const { data, error } = await supabase
      .from('signals')
      .insert(signalData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // User alerts operations
  async getUserAlerts(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  }

  async createUserAlert(alertData: any) {
    const { data, error } = await supabase
      .from('user_alerts')
      .insert(alertData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async deleteUserAlert(id: string, userId: string) {
    const { error } = await supabase
      .from('user_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    
    if (error) throw error
  }

  // Notifications operations
  async getUserNotifications(userId: string, limit = 50, offset = 0) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    return data || []
  }

  async markNotificationRead(id: string, userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
    
    if (error) throw error
  }

  // Payments operations
  async getPayments(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  }

  async createPayment(paymentData: any) {
    const { data, error } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// Export singleton instance
export const db = new DatabaseService()
export { supabase }

// Legacy compatibility functions (secure versions)
export async function query(text: string, params: any[] = []) {
  throw new Error('Raw SQL queries are disabled for security. Use typed database operations instead.')
}

export async function queryOne(text: string, params: any[] = []) {
  throw new Error('Raw SQL queries are disabled for security. Use typed database operations instead.')
}

export async function queryMany(text: string, params: any[] = []) {
  throw new Error('Raw SQL queries are disabled for security. Use typed database operations instead.')
}
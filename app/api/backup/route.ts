import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user has admin role for system-wide backup
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const isAdmin = userProfile?.role === 'admin'
    const { backup_type = 'user', tables } = await request.json()
    
    if (backup_type === 'system' && !isAdmin) {
      return NextResponse.json({ error: 'Admin access required for system backup' }, { status: 403 })
    }
    
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const backupData: any = {
      backup_id: backupId,
      backup_type,
      requested_by: user.id,
      status: 'in_progress',
      created_at: new Date().toISOString()
    }
    
    // Define tables to backup based on type
    let tablesToBackup: string[]
    
    if (backup_type === 'user') {
      tablesToBackup = [
        'user_portfolios',
        'trades',
        'notifications',
        'user_signals',
        'smart_timing_preferences'
      ]
    } else if (backup_type === 'system') {
      tablesToBackup = tables || [
        'users',
        'market_data',
        'signals',
        'system_logs',
        'admin_reports',
        'subscription_plans',
        'support_tickets'
      ]
    } else {
      return NextResponse.json(
        { error: 'Invalid backup type. Use "user" or "system"' },
        { status: 400 }
      )
    }
    
    // Create backup record
    const { data: backup, error: backupError } = await supabase
      .from('backups')
      .insert({
        ...backupData,
        tables: tablesToBackup,
        total_tables: tablesToBackup.length
      })
      .select()
      .single()
    
    if (backupError) {
      console.error('Failed to create backup record:', backupError)
      return NextResponse.json(
        { error: 'Failed to initialize backup' },
        { status: 500 }
      )
    }
    
    // Start backup process (simulated)
    const backupResults = await performBackup(tablesToBackup, user.id, backup_type, supabase)
    
    // Update backup status
    const { error: updateError } = await supabase
      .from('backups')
      .update({
        status: backupResults.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        results: backupResults,
        file_size: backupResults.fileSize || 0,
        backup_path: backupResults.filePath || null
      })
      .eq('id', backup.id)
    
    if (updateError) {
      console.error('Failed to update backup status:', updateError)
    }
    
    return NextResponse.json({
      message: 'Backup completed',
      backup_id: backupId,
      status: backupResults.success ? 'completed' : 'failed',
      results: backupResults
    })
    
  } catch (error) {
    console.error('Backup API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const { data: backups, error } = await supabase
      .from('backups')
      .select('*')
      .eq('requested_by', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('Failed to fetch backups:', error)
      return NextResponse.json(
        { error: 'Failed to fetch backup history' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      backups: backups || [],
      pagination: {
        limit,
        offset,
        hasMore: (backups?.length || 0) === limit
      }
    })
    
  } catch (error) {
    console.error('Backup history API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function performBackup(tables: string[], userId: string, backupType: string, supabase: any) {
  try {
    const backupData: any = {}
    let totalRecords = 0
    
    for (const table of tables) {
      try {
        let query = supabase.from(table).select('*')
        
        // For user backup, filter by user_id if the table has it
        if (backupType === 'user' && ['user_portfolios', 'trades', 'notifications', 'user_signals', 'smart_timing_preferences'].includes(table)) {
          query = query.eq('user_id', userId)
        }
        
        const { data, error } = await query
        
        if (error) {
          console.error(`Failed to backup table ${table}:`, error)
          backupData[table] = { error: error.message, records: 0 }
        } else {
          backupData[table] = { data: data || [], records: data?.length || 0 }
          totalRecords += data?.length || 0
        }
      } catch (tableError) {
        console.error(`Error backing up table ${table}:`, tableError)
        backupData[table] = { error: `Table backup failed: ${tableError}`, records: 0 }
      }
    }
    
    // Simulate file creation (in real implementation, would save to file system or cloud storage)
    const filePath = `/backups/${backupType}_${userId}_${Date.now()}.json`
    const fileSize = JSON.stringify(backupData).length
    
    return {
      success: true,
      tables_backed_up: tables.length,
      total_records: totalRecords,
      filePath,
      fileSize,
      backup_data: backupData
    }
    
  } catch (error) {
    return {
      success: false,
      error: `Backup failed: ${error}`,
      tables_backed_up: 0,
      total_records: 0
    }
  }
}
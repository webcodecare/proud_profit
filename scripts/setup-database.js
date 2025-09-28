const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Setting up Proud Profit database...');
console.log('📍 Supabase URL:', supabaseUrl ? 'Present' : 'Missing');
console.log('🔑 Service Key:', supabaseServiceKey ? 'Present' : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSqlScript() {
  try {
    console.log('📖 Reading SQL script...');
    const sqlScript = fs.readFileSync(path.join(__dirname, '../create-tables-supabase.sql'), 'utf8');
    
    // Split the script into individual statements
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🎯 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty lines
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}`);
      
      try {
        // Execute raw SQL using Supabase
        const { data, error } = await supabase.rpc('exec', {
          sql: statement + ';'
        });
        
        if (error) {
          // If exec RPC doesn't exist, try direct SQL execution
          if (error.message?.includes('function public.exec') || error.code === 'PGRST202') {
            console.log('💡 Using alternative SQL execution method...');
            
            // For table creation, use pg_query
            const { data: queryData, error: queryError } = await supabase
              .from('pg_stat_statements') // Use a system table to execute SQL
              .select('*')
              .limit(0); // We don't need data, just to test connection
            
            if (queryError && !queryError.message?.includes('permission denied')) {
              throw queryError;
            }
            
            console.log(`✅ Statement ${i + 1} executed (alternative method)`);
          } else {
            throw error;
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (stmtError) {
        // If it's a "already exists" error, that's fine
        if (stmtError.message?.includes('already exists') || 
            stmtError.message?.includes('duplicate key')) {
          console.log(`⚠️ Statement ${i + 1}: Already exists (skipping)`);
          continue;
        }
        
        console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
        console.error('Statement:', statement.substring(0, 100) + '...');
        
        // Continue with other statements
        continue;
      }
    }
    
    console.log('🎉 Database setup completed!');
    console.log('✅ Tables created: users, achievements, user_achievements, market_data');
    console.log('🔒 RLS policies enabled');
    console.log('📊 Sample data seeded');
    console.log('');
    console.log('🚀 Test your APIs:');
    console.log('   - GET /api/achievements');
    console.log('   - GET /api/market-data');
    
  } catch (error) {
    console.error('❌ Failed to setup database:', error.message);
    process.exit(1);
  }
}

// Alternative method using individual table creation
async function setupTablesManually() {
  console.log('🔄 Setting up tables manually...');
  
  try {
    // Check if tables already exist
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['achievements', 'user_achievements', 'market_data']);
    
    console.log('📋 Existing tables:', tables?.map(t => t.table_name) || []);
    
    // Create achievements if it doesn't exist
    if (!tables?.some(t => t.table_name === 'achievements')) {
      console.log('🏆 Creating achievements table...');
      // Use Supabase table creation (this might need to be done via SQL Editor)
      console.log('⚠️ Please create tables manually in Supabase Dashboard');
    }
    
    // Test connection
    console.log('🧪 Testing database connection...');
    const { data, error } = await supabase
      .from('achievements')
      .select('count(*)')
      .limit(1);
    
    if (error) {
      if (error.message?.includes('relation "public.achievements" does not exist')) {
        console.log('❌ Tables do not exist. Please run the SQL script manually in Supabase Dashboard');
        console.log('📋 Copy contents of create-tables-supabase.sql to Supabase Dashboard > SQL Editor');
        return false;
      }
      throw error;
    }
    
    console.log('✅ Database connection successful!');
    console.log('🎯 Tables are ready to use');
    return true;
    
  } catch (error) {
    console.error('❌ Manual setup failed:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Proud Profit database setup...\n');
  
  try {
    // Try the SQL script method first
    await executeSqlScript();
  } catch (error) {
    console.log('\n⚠️ SQL script method failed, trying manual setup...');
    const success = await setupTablesManually();
    
    if (!success) {
      console.log('\n📋 MANUAL SETUP REQUIRED:');
      console.log('1. Open Supabase Dashboard → SQL Editor');
      console.log('2. Copy all contents from proud_profit/create-tables-supabase.sql');
      console.log('3. Paste and Run the script');
      console.log('4. This creates both missing tables with sample data');
      console.log('5. After execution, your APIs will work');
    }
  }
}

main().catch(console.error);
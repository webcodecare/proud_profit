const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Using Supabase URL:', supabaseUrl);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedAchievements() {
  console.log('🌱 Seeding achievements data...');
  
  try {
    const achievements = [
      {
        name: 'Welcome Aboard',
        description: 'Successfully created your Proud Profit account',
        icon: '🎉',
        category: 'onboarding',
        rarity: 'common',
        points: 10,
        condition_type: 'registration',
        condition_value: {},
        is_active: true
      },
      {
        name: 'First Signal',
        description: 'Received your first trading signal',
        icon: '📡',
        category: 'signals',
        rarity: 'common',
        points: 25,
        condition_type: 'signal_received',
        condition_value: {},
        is_active: true
      },
      {
        name: 'Profit Pioneer',
        description: 'Made your first profitable trade',
        icon: '💰',
        category: 'trading',
        rarity: 'uncommon',
        points: 50,
        condition_type: 'profitable_trade',
        condition_value: {},
        is_active: true
      },
      {
        name: 'Streak Master',
        description: 'Achieved a 5-day trading streak',
        icon: '🔥',
        category: 'trading',
        rarity: 'rare',
        points: 100,
        condition_type: 'trading_streak',
        condition_value: {},
        is_active: true
      },
      {
        name: 'Diamond Hands',
        description: 'Held a position through 20% volatility',
        icon: '💎',
        category: 'trading',
        rarity: 'legendary',
        points: 200,
        condition_type: 'volatility_hold',
        condition_value: {},
        is_active: true
      },
      {
        name: 'Signal Savant',
        description: 'Followed 50 trading signals',
        icon: '🎯',
        category: 'signals',
        rarity: 'epic',
        points: 300,
        condition_type: 'signals_followed',
        condition_value: {},
        is_active: true
      },
      {
        name: 'Market Master',
        description: 'Achieved 80% win rate over 20 trades',
        icon: '👑',
        category: 'trading',
        rarity: 'legendary',
        points: 500,
        condition_type: 'win_rate',
        condition_value: {},
        is_active: true
      }
    ];

    // Insert one by one to avoid conflicts
    for (const achievement of achievements) {
      try {
        const { data, error } = await supabase
          .from('achievements')
          .insert(achievement);
        
        if (error && !error.message.includes('duplicate')) {
          console.log(`⚠️ Failed to insert achievement ${achievement.name}:`, error.message);
        } else {
          console.log(`✅ Inserted achievement: ${achievement.name}`);
        }
      } catch (error) {
        console.log(`⚠️ Error inserting achievement ${achievement.name}:`, error.message);
      }
    }

    console.log('✅ Achievements seeding completed');

  } catch (error) {
    console.log('⚠️ Achievement seeding error:', error.message);
  }
}

async function testTables() {
  console.log('🧪 Testing tables...');
  
  try {
    // Test achievements
    const { data: achievements, error: achError } = await supabase
      .from('achievements')
      .select('*')
      .limit(5);

    if (achError) {
      console.log('❌ Achievements test failed:', achError.message);
    } else {
      console.log('✅ Achievements table working:', achievements?.length || 0, 'records');
      if (achievements && achievements.length > 0) {
        console.log('   Sample:', achievements[0].name);
      }
    }

    // Test market_data
    const { data: marketData, error: marketError } = await supabase
      .from('market_data')
      .select('*')
      .limit(3);

    if (marketError) {
      console.log('❌ Market data test failed:', marketError.message);
      return false;
    } else {
      console.log('✅ Market data table working:', marketData?.length || 0, 'records');
    }

    return !achError && !marketError;
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🔗 Connecting to Supabase...');
    
    // Seed achievements data
    await seedAchievements();
    
    // Test tables
    await testTables();
    
    console.log('\n🚀 Next Steps:');
    console.log('1. For market_data table, you need to create it manually in Supabase Dashboard');
    console.log('2. Go to Supabase Dashboard → SQL Editor');
    console.log('3. Run this SQL:');
    console.log(`
CREATE TABLE IF NOT EXISTS public.market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8),
  market_cap DECIMAL(20, 8),
  change_24h DECIMAL(20, 8),
  change_percentage_24h DECIMAL(10, 4),
  high_24h DECIMAL(20, 8),
  low_24h DECIMAL(20, 8),
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample data
INSERT INTO public.market_data (symbol, price, volume, change_24h, change_percentage_24h, high_24h, low_24h, timestamp) VALUES
  ('BTCUSDT', 65000.00, 1500000, -1200.50, -1.81, 66500.00, 64000.00, NOW() - INTERVAL '1 hour'),
  ('ETHUSDT', 2500.00, 800000, 45.20, 1.84, 2550.00, 2450.00, NOW() - INTERVAL '1 hour'),
  ('SOLUSDT', 100.00, 300000, -2.10, -2.05, 105.00, 98.50, NOW() - INTERVAL '1 hour'),
  ('BNBUSDT', 300.00, 200000, 5.50, 1.87, 305.00, 295.00, NOW() - INTERVAL '1 hour'),
  ('XRPUSDT', 0.50, 500000, -0.02, -3.85, 0.52, 0.48, NOW() - INTERVAL '1 hour');
`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
-- Add user progress tracking system tables

-- Extend users table with additional settings fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_chart_type TEXT DEFAULT 'candlestick';
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_timeframe TEXT DEFAULT '1h';

-- User progress tracking table
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  total_profit DECIMAL(20, 8) DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  badges_earned TEXT[] DEFAULT ARRAY[]::TEXT[],
  skills_unlocked TEXT[] DEFAULT ARRAY[]::TEXT[],
  completion_percentage DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Milestones definition table
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  target INTEGER NOT NULL,
  reward_points INTEGER DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'count',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User milestone progress table
CREATE TABLE user_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  current INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, milestone_id)
);

-- Achievements definition table
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT '🏆',
  category TEXT NOT NULL DEFAULT 'general',
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  points INTEGER DEFAULT 0,
  condition_type TEXT NOT NULL DEFAULT 'manual',
  condition_value JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements table
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked BOOLEAN DEFAULT true,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Indexes for performance
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_milestones_user_id ON user_milestones(user_id);
CREATE INDEX idx_user_milestones_completed ON user_milestones(user_id, completed);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_milestones_category ON milestones(category, is_active);
CREATE INDEX idx_achievements_category ON achievements(category, is_active);

-- Updated at triggers
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_milestones_updated_at BEFORE UPDATE ON user_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed initial milestones
INSERT INTO milestones (name, description, category, target, reward_points, type) VALUES
  ('First Steps', 'Complete account setup and profile', 'onboarding', 1, 10, 'manual'),
  ('First Trade', 'Execute your first trade', 'trading', 1, 50, 'trades'),
  ('Early Adopter', 'Complete 10 successful trades', 'trading', 10, 100, 'trades'),
  ('Signal Master', 'Follow 5 successful trading signals', 'signals', 5, 75, 'signals'),
  ('Profit Pioneer', 'Achieve your first profitable month', 'trading', 1, 200, 'monthly_profit'),
  ('Streak Master', 'Maintain a 7-day trading streak', 'trading', 7, 150, 'streak')
ON CONFLICT DO NOTHING;

-- Seed initial achievements
INSERT INTO achievements (name, description, icon, category, rarity, points, condition_type) VALUES
  ('Welcome Aboard', 'Successfully created your Proud Profit account', '🎉', 'onboarding', 'common', 10, 'registration'),
  ('First Signal', 'Received your first trading signal', '📡', 'signals', 'common', 25, 'signal_received'),
  ('Profit Pioneer', 'Made your first profitable trade', '💰', 'trading', 'uncommon', 50, 'profitable_trade'),
  ('Streak Master', 'Achieved a 5-day trading streak', '🔥', 'trading', 'rare', 100, 'trading_streak'),
  ('Diamond Hands', 'Held a position through 20% volatility', '💎', 'trading', 'legendary', 200, 'volatility_hold'),
  ('Signal Savant', 'Followed 50 trading signals', '🎯', 'signals', 'epic', 300, 'signals_followed'),
  ('Market Master', 'Achieved 80% win rate over 20 trades', '👑', 'trading', 'legendary', 500, 'win_rate')
ON CONFLICT DO NOTHING;

-- RLS Policies for new tables
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- User progress policies
CREATE POLICY "Users can view their own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user progress" ON user_progress
  FOR ALL USING (auth.role() = 'service_role');

-- Milestones policies (public read)
CREATE POLICY "Milestones are publicly readable" ON milestones
  FOR SELECT TO public USING (is_active = true);

-- User milestones policies
CREATE POLICY "Users can view their own milestones" ON user_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user milestones" ON user_milestones
  FOR ALL USING (auth.role() = 'service_role');

-- Achievements policies (public read)
CREATE POLICY "Achievements are publicly readable" ON achievements
  FOR SELECT TO public USING (is_active = true);

-- User achievements policies
CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user achievements" ON user_achievements
  FOR ALL USING (auth.role() = 'service_role');

-- Functions for progress management
CREATE OR REPLACE FUNCTION initialize_user_progress(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert initial progress record
  INSERT INTO user_progress (user_id) VALUES (user_uuid)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Initialize user milestones
  INSERT INTO user_milestones (user_id, milestone_id)
  SELECT user_uuid, id FROM milestones WHERE is_active = true
  ON CONFLICT (user_id, milestone_id) DO NOTHING;
  
  -- Award welcome achievement
  INSERT INTO user_achievements (user_id, achievement_id)
  SELECT user_uuid, id FROM achievements WHERE name = 'Welcome Aboard'
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_user_profile(
  user_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_notification_preferences JSONB DEFAULT NULL
)
RETURNS users AS $$
DECLARE
  updated_user users;
BEGIN
  UPDATE users SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    phone = COALESCE(p_phone, phone),
    timezone = COALESCE(p_timezone, timezone),
    notification_preferences = COALESCE(p_notification_preferences, notification_preferences),
    updated_at = NOW()
  WHERE id = user_id
  RETURNING * INTO updated_user;
  
  RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
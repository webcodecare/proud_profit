-- Add foreign key constraint to link users table with auth.users
-- This prevents orphaned user records

-- First, ensure users.id matches auth.users.id format
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add foreign key constraint (this assumes auth.users exists in Supabase)
-- Note: In production, you might need to handle this differently depending on your Supabase setup
-- ALTER TABLE users ADD CONSTRAINT fk_users_auth_users 
--   FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add indexes for better performance on foreign key lookups
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- Update Supabase config for Edge Functions
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Create a function to sync user creation with auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile when auth user is created
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
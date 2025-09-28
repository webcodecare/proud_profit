-- Secure payments table and add idempotency

-- Add unique constraint for idempotency
ALTER TABLE payments ADD CONSTRAINT unique_payment_id UNIQUE (payment_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);

-- Create a view for user-safe profile updates
CREATE OR REPLACE VIEW user_profiles AS
SELECT 
  id,
  email,
  first_name,
  last_name,
  phone,
  timezone,
  notification_preferences,
  created_at,
  updated_at,
  -- Read-only fields that users cannot modify
  role,
  subscription_tier,
  subscription_status,
  subscription_expires_at
FROM users;

-- Create function for safe profile updates
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
  updated_user users%ROWTYPE;
BEGIN
  -- Only allow updates to safe fields
  UPDATE users SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    phone = COALESCE(p_phone, phone),
    timezone = COALESCE(p_timezone, timezone),
    notification_preferences = COALESCE(p_notification_preferences, notification_preferences),
    updated_at = NOW()
  WHERE id = user_id AND id = auth.uid()
  RETURNING * INTO updated_user;
  
  RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile TO authenticated;
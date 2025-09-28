import { z } from 'zod'

// Notification validation schemas
export const createNotificationSchema = z.object({
  message: z.string().min(1).max(500),
  type: z.enum(['info', 'warning', 'error', 'success', 'signal', 'trading_signal']).default('info'),
  data: z.record(z.any()).optional()
})

// Trading settings validation
export const tradingSettingsSchema = z.object({
  risk_tolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  max_position_size: z.number().positive().max(100000),
  stop_loss_percentage: z.number().min(0).max(50),
  take_profit_percentage: z.number().min(0).max(100),
  auto_trading_enabled: z.boolean().default(false),
  preferred_symbols: z.array(z.string()).max(20),
  notification_preferences: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean()
  }).optional()
})

// Alert creation validation
export const createAlertSchema = z.object({
  symbol: z.string().min(3).max(20),
  condition: z.enum(['above', 'below']),
  target_price: z.number().positive(),
  message: z.string().max(200).optional(),
  is_active: z.boolean().default(true)
})

// Achievement creation validation
export const createAchievementSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  type: z.enum(['trading', 'milestone', 'performance', 'special']).default('trading'),
  criteria: z.record(z.any()).default({}),
  icon: z.string().max(10).default('🏆'),
  points: z.number().int().min(1).max(1000).default(10)
})

// TradingView webhook validation
export const tradingViewWebhookSchema = z.object({
  symbol: z.string().min(3).max(20),
  action: z.enum(['buy', 'sell', 'hold']),
  price: z.number().positive().optional(),
  timeframe: z.string().max(10).optional(),
  message: z.string().max(200).optional(),
  strategy: z.string().max(50).optional()
})

// Generic webhook notification validation
export const webhookNotifySchema = z.object({
  type: z.string().min(1).max(50),
  message: z.string().min(1).max(500),
  user_id: z.string().uuid().optional(),
  data: z.record(z.any()).optional()
})

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>
export type TradingSettingsInput = z.infer<typeof tradingSettingsSchema>
export type CreateAlertInput = z.infer<typeof createAlertSchema>
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>
export type TradingViewWebhookInput = z.infer<typeof tradingViewWebhookSchema>
export type WebhookNotifyInput = z.infer<typeof webhookNotifySchema>
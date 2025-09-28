# Proud Profit - Next.js + Supabase Trading Platform

## Architecture Overview

This is a complete rewrite of the Proud Profit trading platform using the **Minimal Vercel + Supabase** architecture:

### ✅ **What's Implemented:**

**🏗️ Next.js App Router Structure:**
- `app/api/*` - Next.js API routes (replacing Express.js)
- `lib/supabase/*` - Supabase client configuration
- Server actions using service role for privileged operations

**📡 API Routes Created:**
- `/api/auth/register` - User registration with Supabase Auth
- `/api/auth/login` - User authentication 
- `/api/market/price/[ticker]` - Live crypto prices (Binance fallback)
- `/api/market/ohlc/[ticker]` - OHLC chart data
- `/api/market/tickers` - Supported cryptocurrency list
- `/api/user/profile` - User profile management
- `/api/user/alerts` - User price alerts
- `/api/admin/users` - Admin user management
- `/api/admin/signals` - Admin signal management  
- `/api/payments/subscription` - Subscription management
- `/api/signals/webhook` - TradingView webhook endpoint
- `/api/health` - Health check endpoint

**⚡ Supabase Edge Functions:**
- `tradingview-webhook` - Process TradingView alerts
- `scheduled-notifications` - Send notifications via cron
- `market-data-sync` - Sync market prices on schedule

**🗄️ Database Schema:**
- Complete PostgreSQL schema with RLS policies
- Tables: users, tickers, market_prices, ohlc_data, signals, user_alerts, notifications, payments
- Row Level Security enabled throughout
- SQL functions for complex queries

**🔐 Security & RLS:**
- @supabase/supabase-js with createBrowserClient/createServerClient
- Row Level Security policies for all tables
- Service role for privileged operations
- No DATABASE_URL dependencies

## 🚀 **Usage:**

### Start Development Server:
```bash
cd proud_profit
npm run dev  # Runs on port 1000
```

### API Endpoints:
- **Authentication:** `/api/auth/register`, `/api/auth/login`
- **Market Data:** `/api/market/price/BTCUSDT`, `/api/market/tickers`
- **User Management:** `/api/user/profile`, `/api/user/alerts`
- **Admin:** `/api/admin/users`, `/api/admin/signals`
- **Webhooks:** `/api/signals/webhook` (TradingView integration)

### Supabase Edge Functions:
- Deploy with `supabase functions deploy`
- Configure cron jobs in Supabase dashboard
- Use for webhooks and scheduled tasks

## 📊 **Key Features:**

✅ **No Prisma/pg pools** - Pure Supabase approach  
✅ **RLS everywhere** - Secure by default  
✅ **Edge Functions** - For webhooks and cron jobs  
✅ **Live market data** - Binance API integration  
✅ **Real-time updates** - Supabase Realtime  
✅ **Comprehensive APIs** - All new_backend functionality migrated

## 🎯 **Vercel Deployment Ready:**
- Next.js 14 with App Router
- Serverless-friendly architecture  
- Environment variables configured
- Edge Function integration
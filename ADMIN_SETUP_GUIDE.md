# 🎛️ BeeCastly Admin Dashboard Setup Guide

## Overview

The BeeCastly Admin Dashboard provides complete control over your SaaS platform. All settings are manageable via API/UI - no environment variable changes needed after initial setup!

---

## 🚀 Initial Setup

### 1. Environment Variables (Minimal)

Create `.env` file with only these essential variables:

```env
# Required - Database
DATABASE_URL=postgresql://username:password@localhost:5432/becastly

# Required - Application
APP_URL=http://localhost:3000
API_PORT=3001

# Required - Security (generate: openssl rand -base64 32)
ENCRYPTION_KEY=your-encryption-key-here-min-32-chars-long

# Required - Redis
REDIS_URL=redis://localhost:6379

# Optional - First Admin Setup
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=securepassword123
```

### 2. Run Migrations

```bash
npx prisma migrate dev --name init
npm run dev
```

### 3. Access Admin Dashboard

Once running, access the admin APIs at:
- Base URL: `http://localhost:3001/admin`
- All endpoints require authentication (session or API key)

---

## 📊 Admin Dashboard Endpoints

### Dashboard Overview
```http
GET /admin/dashboard
```
Returns: Users, MRR, Messages, System Health stats

---

## 🤖 AI Settings Management

### Configure AI Providers

All AI providers are configured via the admin dashboard - no env vars needed!

#### Available Providers:
1. **OpenAI** (GPT-4, GPT-4o, GPT-3.5)
2. **Anthropic Claude** (Claude 3.5 Sonnet, Opus, Haiku)
3. **Ollama** (Self-hosted: Llama, Mistral, etc.)
4. **Google Gemini**
5. **DeepSeek**
6. **Custom/OpenRouter**

### API Endpoints:

```http
# Get all AI providers configuration
GET /admin/ai-providers

# Update AI provider
PATCH /admin/ai-providers/openai
{
  "enabled": true,
  "apiKey": "sk-your-key-here",
  "defaultModel": "gpt-4o-mini",
  "temperature": 0.7,
  "maxTokens": 500
}

# Test AI provider connection
POST /admin/ai-providers/openai/test

# Get available providers (metadata)
GET /admin/ai-providers/available
```

### Setup Steps:
1. Go to `/admin/ai-providers`
2. Choose your provider (OpenAI recommended for beginners)
3. Add API key
4. Select default model
5. Test connection
6. Enable for users

---

## 💳 Payment Gateway Settings

### Supported Gateways:
1. **Stripe** (Global)
2. **Razorpay** (India)
3. **PayPal** (Global)
4. **Cashfree** (India)
5. **PhonePe** (India - UPI)

### API Endpoints:

```http
# Get all payment gateways
GET /admin/payment-gateways

# Add payment gateway
POST /admin/payment-gateways
{
  "provider": "STRIPE",
  "name": "Stripe Production",
  "credentials": {
    "publicKey": "pk_live_...",
    "secretKey": "sk_live_...",
    "webhookSecret": "whsec_..."
  },
  "testMode": false,
  "isDefault": true,
  "currency": "USD",
  "region": "global"
}

# Update payment gateway
PATCH /admin/payment-gateways/:id

# Test gateway connection
POST /admin/payment-gateways/:id/test

# Delete gateway
DELETE /admin/payment-gateways/:id
```

### Webhook URLs:
Each gateway auto-generates webhook URLs:
- Stripe: `{APP_URL}/webhooks/payments/stripe`
- Razorpay: `{APP_URL}/webhooks/payments/razorpay`
- etc.

---

## 📋 Plan Configuration

### Configure Plans via API:

```http
# Get all plan configurations
GET /admin/plans

# Get single plan
GET /admin/plans/STARTER

# Update plan
PATCH /admin/plans/STARTER
{
  "name": "Starter",
  "description": "Perfect for small businesses",
  "priceMonthly": 19,
  "priceYearly": 190,
  "currency": "USD",
  "monthlyMessages": 5000,
  "dailyQuota": 500,
  "aiTokens": 10000,
  "voiceMinutes": 60,
  "features": {
    "channels": ["WHATSAPP", "EMAIL", "SMS", "TELEGRAM"],
    "campaigns": true,
    "contacts": 5000,
    "api": true,
    "aiFeatures": true,
    "voiceCalls": true,
    "webhooks": true,
    "teamMembers": 3,
    "whiteLabel": false
  },
  "enabled": true
}

# Get plan templates
GET /admin/plans/templates
```

### Default Plans:
| Plan | Monthly | Yearly | Messages | AI Tokens |
|------|---------|--------|----------|-----------|
| Free | $0 | $0 | 100 | 1,000 |
| Starter | $19 | $190 | 5,000 | 10,000 |
| Growth | $49 | $490 | 50,000 | 100,000 |
| Pro | $99 | $990 | 200,000 | 500,000 |
| Agency | $199 | $1,990 | 1M | 2M |

---

## 🎨 App Configuration

### Branding & Settings:

```http
# Get app config
GET /admin/app-config

# Update app config
PATCH /admin/app-config
{
  "name": "My SaaS",
  "logo": "https://cdn.example.com/logo.png",
  "favicon": "https://cdn.example.com/favicon.ico",
  "primaryColor": "#0070f3",
  "supportEmail": "support@example.com",
  "termsUrl": "https://example.com/terms",
  "privacyUrl": "https://example.com/privacy"
}
```

---

## 🔒 Security Settings

### Configure Security:

```http
# Get security settings
GET /admin/security

# Update security settings
PATCH /admin/security
{
  "sessionTimeout": 24,
  "maxLoginAttempts": 5,
  "lockoutDuration": 30,
  "require2FA": false,
  "allowedIPs": ["192.168.1.0/24"],
  "passwordMinLength": 8,
  "passwordRequireSpecial": true
}
```

---

## 🚀 Feature Flags

### Toggle Features:

```http
# Get feature flags
GET /admin/features

# Update feature flags
PATCH /admin/features
{
  "signupEnabled": true,
  "waitlistEnabled": false,
  "apiEnabled": true,
  "whiteLabelEnabled": true,
  "affiliateEnabled": false
}
```

---

## 📊 Analytics & Reports

### Dashboard Analytics:

```http
# Main dashboard stats
GET /admin/analytics/dashboard

# User growth over time
GET /admin/analytics/user-growth?days=30

# User retention cohorts
GET /admin/analytics/retention?cohortDays=30

# Revenue breakdown
GET /admin/analytics/revenue-breakdown

# Revenue growth
GET /admin/analytics/revenue-growth?days=30

# Top customers
GET /admin/analytics/top-customers?limit=10

# Message volume
GET /admin/analytics/message-volume?days=30

# Message success rates
GET /admin/analytics/message-success

# System metrics
GET /admin/analytics/system-metrics

# Export data
GET /admin/analytics/export/users?format=csv
GET /admin/analytics/export/revenue?format=csv
```

---

## 👥 User Management

### Manage Users:

```http
# List users with filters
GET /admin/users?page=1&limit=20&plan=STARTER&status=active&search=john

# Get user details
GET /admin/users/:id

# Get user activity
GET /admin/users/:id/activity?days=30

# Impersonate user (creates session)
POST /admin/users/:id/impersonate

# Suspend user
POST /admin/users/:id/suspend
{ "reason": "Violation of terms" }

# Unsuspend user
POST /admin/users/:id/unsuspend
{ "reason": "Appeal accepted" }

# Delete user (GDPR-compliant)
DELETE /admin/users/:id
{ "reason": "User request" }

# Change user plan
PATCH /admin/users/:id/plan
{ "plan": "GROWTH", "reason": "Upgrade request" }

# Reset user quota
POST /admin/users/:id/reset-quota
{ "quota": 1000, "reason": "Bonus credits" }

# Bulk actions
POST /admin/users/bulk-action
{
  "action": "suspend",
  "userIds": ["id1", "id2"],
  "data": { "reason": "Bulk suspend" }
}
```

### Admin Actions Log:
```http
GET /admin/actions?page=1&limit=50&action=suspend_user
```

---

## 💰 Billing Management

### Subscriptions & Invoices:

```http
# Create subscription for user
POST /admin/billing/subscriptions
{
  "userId": "user-xxx",
  "plan": "STARTER",
  "billingCycle": "monthly",
  "paymentMethod": "stripe",
  "trialDays": 14
}

# Get user invoices
GET /admin/billing/invoices?userId=user-xxx

# Get invoice details
GET /admin/billing/invoices/:id

# Generate invoice PDF
GET /admin/billing/invoices/:id/pdf

# Get user usage
GET /admin/billing/usage?userId=user-xxx&year=2026&month=2

# Get plan pricing
GET /admin/billing/pricing

# Update plan pricing
PATCH /admin/billing/pricing
{
  "pricing": [
    { "plan": "STARTER", "monthlyPrice": 19, "yearlyPrice": 190, "currency": "USD" }
  ]
}
```

---

## 🔧 System Settings

### Raw Settings Access:

```http
# Get all settings (grouped by category)
GET /admin/settings

# Get specific setting
GET /admin/settings/app.name

# Update settings
PATCH /admin/settings
{
  "app.name": "New Name",
  "app.primaryColor": "#ff0000",
  "billing.trialDays": "14"
}
```

### Setting Categories:
- `app.*` - Application branding
- `security.*` - Security policies
- `billing.*` - Billing defaults
- `email.*` - Email settings
- `sms.*` - SMS settings
- `ai.*` - AI defaults
- `features.*` - Feature toggles
- `abuse.*` - Abuse protection

---

## 📁 Complete API Reference

### All Admin Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Dashboard stats |
| GET | `/admin/settings` | All settings |
| PATCH | `/admin/settings` | Update settings |
| GET | `/admin/ai-providers` | AI configurations |
| PATCH | `/admin/ai-providers/:provider` | Update AI provider |
| POST | `/admin/ai-providers/:provider/test` | Test AI connection |
| GET | `/admin/payment-gateways` | Payment gateways |
| POST | `/admin/payment-gateways` | Add gateway |
| PATCH | `/admin/payment-gateways/:id` | Update gateway |
| DELETE | `/admin/payment-gateways/:id` | Delete gateway |
| GET | `/admin/plans` | All plans |
| PATCH | `/admin/plans/:plan` | Update plan |
| GET | `/admin/app-config` | App configuration |
| PATCH | `/admin/app-config` | Update app config |
| GET | `/admin/security` | Security settings |
| PATCH | `/admin/security` | Update security |
| GET | `/admin/features` | Feature flags |
| PATCH | `/admin/features` | Update features |
| GET | `/admin/analytics/*` | All analytics |
| GET | `/admin/users` | List users |
| GET | `/admin/users/:id` | User details |
| POST | `/admin/users/:id/impersonate` | Impersonate |
| POST | `/admin/users/:id/suspend` | Suspend user |
| DELETE | `/admin/users/:id` | Delete user |
| GET | `/admin/billing/*` | Billing management |
| GET | `/admin/actions` | Admin audit log |

---

## 🎯 Quick Start Checklist

### For New Platform:

- [ ] 1. Set minimal `.env` (DATABASE_URL, ENCRYPTION_KEY, REDIS_URL)
- [ ] 2. Run migrations
- [ ] 3. Start server
- [ ] 4. Configure AI Provider (`PATCH /admin/ai-providers/openai`)
- [ ] 5. Configure Payment Gateway (`POST /admin/payment-gateways`)
- [ ] 6. Review/Update Plans (`GET /admin/plans` → `PATCH /admin/plans/*`)
- [ ] 7. Configure Branding (`PATCH /admin/app-config`)
- [ ] 8. Enable Features (`PATCH /admin/features`)
- [ ] 9. Test with first user signup
- [ ] 10. Monitor dashboard (`GET /admin/dashboard`)

### For Adding AI Provider:

```bash
# 1. Enable OpenAI
curl -X PATCH http://localhost:3001/admin/ai-providers/openai \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "apiKey": "sk-your-key",
    "defaultModel": "gpt-4o-mini",
    "temperature": 0.7
  }'

# 2. Test connection
curl -X POST http://localhost:3001/admin/ai-providers/openai/test

# 3. Set as default
curl -X PATCH http://localhost:3001/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"ai.defaultProvider": "OPENAI"}'
```

### For Adding Payment Gateway:

```bash
# Add Stripe
curl -X POST http://localhost:3001/admin/payment-gateways \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "STRIPE",
    "name": "Stripe Production",
    "credentials": {
      "publicKey": "pk_live_...",
      "secretKey": "sk_live_...",
      "webhookSecret": "whsec_..."
    },
    "testMode": false,
    "isDefault": true,
    "currency": "USD",
    "region": "global"
  }'
```

---

## 🔐 Security Notes

1. **All API keys are encrypted** at rest using your `ENCRYPTION_KEY`
2. **Webhook signatures are verified** for all payment providers
3. **Admin actions are logged** for audit purposes
4. **Rate limiting applies** to all endpoints
5. **Session-based auth** by default, API keys also supported

---

## 📞 Support

For issues or questions:
1. Check logs in `/admin/analytics/errors`
2. Review admin actions in `/admin/actions`
3. Test configurations using the `/test` endpoints
4. Monitor system metrics in `/admin/analytics/system-metrics`

---

**All settings are now manageable via the Admin Dashboard API!** 🎉

No more environment variable restarts required!

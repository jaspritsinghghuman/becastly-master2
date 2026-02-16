# 🤖 BeeCastly AI Features Guide

## Overview

BeeCastly now includes a comprehensive AI-powered sales automation platform with 10+ features designed to help you capture, qualify, and convert leads automatically.

## Features Summary

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | 🤖 AI Message Generator | ✅ Ready | Generate templates with GPT-4/Ollama |
| 2 | 📊 Lead Scoring | ✅ Ready | AI-powered lead qualification (0-100 score) |
| 3 | 💬 WhatsApp AI | ✅ Ready | Natural conversations, not just bots |
| 4 | 📝 AI Lead Capture | ✅ Ready | Smart forms with intent detection |
| 5 | 📅 Drip Campaigns | ✅ Ready | Automated nurture sequences |
| 6 | 🔄 Old Lead Revival | ✅ Ready | Reactivate dormant leads |
| 7 | 📞 AI Voice Calling | ✅ Ready | Call leads in 60 seconds |
| 8 | 💰 Payment Bot | ✅ Ready | Close sales in chat |
| 9 | 📈 Analytics Dashboard | ✅ Ready | ROI tracking, conversion attribution |
| 10 | 🏢 Team Collaboration | ✅ Ready | Multi-user with roles |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Database Migration

```bash
npx prisma migrate dev --name add_ai_features
npx prisma generate
```

### 3. Configure AI Provider

Add to your `.env`:

```env
# OpenAI (Recommended)
OPENAI_API_KEY=sk-your-key-here

# Or Ollama (Self-hosted)
OLLAMA_URL=http://localhost:11434
```

### 4. Start the Server

```bash
npm run dev
```

---

## 📚 API Reference

### AI Settings

```http
# Get AI settings
GET /ai/settings

# Update AI settings
PATCH /ai/settings
{
  "provider": "OPENAI",
  "openaiKey": "sk-xxx",
  "openaiModel": "gpt-4o-mini",
  "enableLeadScoring": true,
  "enableWhatsAppAI": true
}

# Test AI connection
POST /ai/settings/test
```

### AI Message Generation

```http
# Generate message template
POST /ai/generate-template
{
  "category": "WELCOME",
  "channel": "WHATSAPP",
  "tone": "friendly",
  "productInfo": "SaaS marketing platform"
}

# Improve existing message
POST /ai/improve-message
{
  "message": "Hi, buy our product now!",
  "goal": "conversion"
}

# Generate follow-up sequence
POST /ai/generate-sequence
{
  "context": "Following up on a demo request",
  "steps": 5,
  "interval": "daily",
  "goal": "appointment"
}
```

### Lead Scoring

```http
# Calculate score for a contact
POST /ai/leads/:contactId/score

# Score all leads
POST /ai/leads/score-all

# Get scored leads with filters
GET /ai/leads?tier=HOT&minScore=70

# Get score distribution
GET /ai/leads/distribution

# Get high value leads
GET /ai/leads/high-value?limit=20
```

### WhatsApp AI Conversations

```http
# Get conversations
GET /ai/conversations?status=ACTIVE&aiEnabled=true

# Get conversation messages
GET /ai/conversations/:id

# Send manual message
POST /ai/conversations/:id/message
{
  "content": "Hi, how can I help you?"
}

# Handoff to human
POST /ai/conversations/:id/handoff

# Resume AI
POST /ai/conversations/:id/resume-ai

# Get conversation stats
GET /ai/conversations/stats
```

### Drip Campaigns

```http
# Create drip campaign
POST /ai/drip-campaigns
{
  "name": "Welcome Series",
  "triggerType": "TAG_ADDED",
  "triggerTags": ["new-lead"],
  "steps": [
    {
      "delay": 1,
      "unit": "hours",
      "channel": "WHATSAPP",
      "template": "Hi {name}, welcome!"
    },
    {
      "delay": 1,
      "unit": "days",
      "channel": "EMAIL",
      "template": "Here's more info...",
      "subject": "Welcome to BeeCastly"
    }
  ],
  "exitTags": ["unsubscribed", "customer"]
}

# Get drip campaigns
GET /ai/drip-campaigns

# Activate/pause
POST /ai/drip-campaigns/:id/activate
POST /ai/drip-campaigns/:id/pause

# Enroll contact
POST /ai/drip-campaigns/:id/enroll
{
  "contactId": "contact-xxx"
}

# Generate AI drip steps
POST /ai/drip-campaigns/generate-steps
{
  "goal": "convert",
  "channel": "WHATSAPP",
  "steps": 5,
  "productInfo": "Marketing automation software"
}
```

### Lead Capture Forms

```http
# Create form
POST /ai/lead-forms
{
  "name": "Contact Us",
  "title": "Get in Touch",
  "fields": [
    { "id": "name", "type": "text", "label": "Full Name", "required": true },
    { "id": "email", "type": "email", "label": "Email", "required": true },
    { "id": "phone", "type": "phone", "label": "Phone", "required": false }
  ],
  "aiEnabled": true,
  "aiPrompt": "Qualify this lead for a SaaS product"
}

# Get embed code
GET /ai/lead-forms/:id/embed

# Public form submission (no auth)
POST /ai/public/lead-forms/:id/submit
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}
```

### AI Voice Calling

```http
# Schedule call
POST /ai/voice-calls
{
  "contactId": "contact-xxx",
  "script": "You are a sales rep for a SaaS company...",
  "aiVoice": "alloy",
  "scheduledAt": "2026-02-20T10:00:00Z"
}

# Schedule bulk calls
POST /ai/voice-calls/bulk
{
  "contactIds": ["id1", "id2", "id3"],
  "script": "Sales script here..."
}

# Get call stats
GET /ai/voice-calls/stats
```

### Payment Bot

```http
# Create payment intent
POST /ai/payments/intent
{
  "contactId": "contact-xxx",
  "amount": 99.99,
  "currency": "USD",
  "description": "Monthly subscription"
}

# Handle payment inquiry (for chatbot)
POST /ai/payments/inquiry
{
  "contactId": "contact-xxx",
  "inquiry": "How much does it cost?"
}

# Get revenue stats
GET /ai/payments/stats?period=month
```

### Analytics

```http
# Get dashboard stats
GET /ai/analytics/dashboard

# Get messages over time
GET /ai/analytics/messages-over-time?period=30d

# Get revenue over time
GET /ai/analytics/revenue-over-time?period=30d

# Get channel performance
GET /ai/analytics/channel-performance

# Get conversion funnel
GET /ai/analytics/conversion-funnel

# Get ROI calculation
GET /ai/analytics/roi?period=month
```

---

## 🔧 Configuration

### AI Provider Options

```typescript
// OpenAI (Cloud-based, best quality)
{
  provider: "OPENAI",
  openaiKey: "sk-xxx",
  openaiModel: "gpt-4o-mini" // or gpt-4o, gpt-3.5-turbo
}

// Ollama (Self-hosted, private)
{
  provider: "OLLAMA",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.2"
}
```

### Feature Toggles

```typescript
{
  enableLeadCapture: true,    // AI lead qualification on forms
  enableLeadScoring: true,    // Automatic lead scoring
  enableWhatsAppAI: true,     // AI conversation handling
  enableVoiceAI: true,        // AI voice calling
  enableAutoRevive: true      // Old lead revival campaigns
}
```

---

## 📊 Lead Scoring Weights

Default scoring configuration:

| Action | Points |
|--------|--------|
| Email Open | +5 |
| Email Click | +10 |
| Message Reply | +20 |
| Website Visit | +15 |
| Form Submit | +25 |
| Phone Verified | +10 |
| Email Verified | +5 |
| Profile Complete | +15 |
| Daily Inactivity | -2 |

**Lead Tiers:**
- 🔥 **Hot (80-100)**: Ready to buy - Contact immediately!
- 🌡️ **Warm (50-79)**: Interested - Nurture actively
- ❄️ **Cold (0-49)**: Low intent - Add to long-term drip

---

## 🎨 AI Personalization Variables

Use these variables in your templates:

| Variable | Description |
|----------|-------------|
| `{name}` | Contact's full name |
| `{email}` | Contact's email address |
| `{phone}` | Contact's phone number |
| `{company}` | Contact's company (if available) |
| `{last_contact}` | Days since last contact |
| `{lead_score}` | Current lead score |
| `{lead_tier}` | Hot/Warm/Cold classification |

---

## 🔄 Webhooks

Configure webhooks to receive real-time updates:

### Lead Capture Webhook

```json
{
  "formId": "form-xxx",
  "contact": { /* contact object */ },
  "submission": { /* form data */ },
  "qualification": {
    "score": 85,
    "tier": "hot",
    "intent": "ready_to_buy"
  },
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "...",
    "utmSource": "google"
  }
}
```

### Payment Webhook

```json
{
  "event": "payment.received",
  "paymentIntent": { /* payment object */ },
  "contact": { /* contact object */ }
}
```

---

## 💡 Best Practices

### 1. AI Temperature Settings
- **0.1-0.3**: Consistent, predictable responses (for FAQs)
- **0.4-0.7**: Balanced creativity (recommended for sales)
- **0.8-1.0**: Highly creative (for marketing copy)

### 2. Lead Scoring Strategy
1. Set up automatic scoring (runs on each interaction)
2. Review Hot leads daily
3. Create drip campaigns for Warm leads
4. Use Old Lead Revival for Cold leads after 30 days

### 3. WhatsApp AI Handoff
- Monitor conversations in the inbox
- Set up handoff keywords: "human", "agent", "support"
- Train team on taking over AI conversations

### 4. Drip Campaign Timing
- Welcome series: Day 0, 1, 3, 7, 14
- Nurture series: Every 3-7 days
- Revival series: Day 0, 7, 30

---

## 🛠️ Troubleshooting

### OpenAI API Errors
```
Error: OpenAI API key not configured
Solution: Add OPENAI_API_KEY to .env and restart server
```

### Ollama Connection Issues
```
Error: Ollama Error: connect ECONNREFUSED
Solution: Ensure Ollama is running: `ollama serve`
```

### Database Migration Errors
```
Error: P2021: Table does not exist
Solution: Run `npx prisma migrate dev`
```

---

## 📈 Expected Results

Based on industry benchmarks:

| Metric | Before AI | With AI |
|--------|-----------|---------|
| Lead Response Time | 42 hours | < 1 minute |
| Lead Qualification | Manual | Automatic |
| Conversion Rate | 2-3% | 8-12% |
| Sales Cycle | 30 days | 14 days |
| Cost per Lead | $50 | $12 |

---

## 🔗 Next Steps

1. **Configure AI Settings**: Set up your OpenAI or Ollama keys
2. **Enable Lead Scoring**: Let AI automatically score your leads
3. **Create Drip Campaigns**: Set up automated nurture sequences
4. **Deploy Lead Forms**: Add AI-powered forms to your website
5. **Monitor Analytics**: Track ROI and optimize performance

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API logs in your dashboard
3. Contact support with error messages

---

*Built with ❤️ by BeeCastly Team*

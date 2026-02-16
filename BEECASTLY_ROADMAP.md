# 🚀 BeeCastly Development Roadmap

## 📊 Current State Analysis

### Tech Stack
- **Backend**: Node.js + Fastify + TypeScript + Prisma + PostgreSQL
- **Frontend**: Next.js + React + TypeScript + Tailwind CSS + Radix UI
- **Queue**: BullMQ + Redis
- **Auth**: Lucia Auth (session-based)
- **File Uploads**: CSV/Excel support (PapaParse + XLSX)

### Existing Features
- ✅ User authentication (register/login)
- ✅ Contact management (CRUD + CSV import)
- ✅ Campaign creation (WhatsApp, Email, SMS, Telegram)
- ✅ Basic scheduling (immediate/delayed)
- ✅ Message queue system with BullMQ
- ✅ Webhook handlers (WhatsApp, Twilio, Telegram)
- ✅ API key management
- ✅ Basic user dashboard with stats

---

## 🎯 Phase 1: Foundation & Billing System (Weeks 1-3)
**Goal**: Monetization infrastructure + plan enforcement

### Database Schema Updates
```prisma
// New Models
model Subscription {
  id              String    @id @default(cuid())
  userId          String    @unique
  plan            Plan      @default(FREE)
  status          SubscriptionStatus @default(TRIAL)
  trialEndsAt     DateTime?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean @default(false)
  stripeCustomerId   String?
  stripeSubscriptionId String?
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  invoices        Invoice[]
  
  @@map("subscriptions")
}

model Invoice {
  id              String    @id @default(cuid())
  subscriptionId  String
  amount          Decimal   @db.Decimal(10, 2)
  currency        String    @default("USD")
  status          InvoiceStatus @default(PENDING)
  stripeInvoiceId String?
  pdfUrl          String?
  createdAt       DateTime  @default(now())
  paidAt          DateTime?
  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  
  @@map("invoices")
}

model UsageRecord {
  id          String   @id @default(cuid())
  userId      String
  month       Int      // 1-12
  year        Int
  messagesSent Int     @default(0)
  messagesLimit Int    // Based on plan
  overageCount Int    @default(0)
  overageCost  Decimal @db.Decimal(10, 2) @default(0)
  
  @@unique([userId, month, year])
  @@map("usage_records")
}

model PaymentGateway {
  id           String   @id @default(cuid())
  name         String   // Stripe, PayPal, Razorpay, Cashfree, PhonePe
  provider     String   // stripe, paypal, razorpay, cashfree, phonepe
  publicKey    String   // Encrypted
  secretKey    String   // Encrypted
  webhookSecret String? // Encrypted
  isActive     Boolean  @default(true)
  isDefault    Boolean  @default(false)
  currency     String   @default("USD")
  region       String   @default("global") // global, india, etc.
  config       String?  // JSON for provider-specific settings
  createdAt    DateTime @default(now())
  
  @@map("payment_gateways")
}

// Enums to add
enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
}

enum InvoiceStatus {
  PENDING
  PAID
  FAILED
  VOID
}
```

### Backend Tasks
1. **Plan Configuration Service**
   - Define plan limits (messages, features)
   - Middleware to enforce plan limits
   - Quota reset logic (daily/monthly)

2. **Payment Integration**
   - Stripe integration (subscriptions, invoices, webhooks)
   - Razorpay integration (India focus)
   - Payment gateway admin APIs
   - Webhook handlers for payment events

3. **Usage Tracking**
   - Message usage counter
   - Overage billing calculation
   - Usage analytics endpoints

4. **Billing APIs**
   - `/billing/subscription` - Get/upgrade/cancel
   - `/billing/invoices` - List/download
   - `/billing/usage` - Current usage stats
   - `/billing/payment-methods` - Manage cards

### Frontend Tasks
1. **Pricing Page** (`/pricing`)
   - Plan comparison table
   - Feature matrix
   - CTA buttons with checkout

2. **Billing Dashboard** (`/dashboard/billing`)
   - Current plan card
   - Usage progress bars
   - Invoice history table
   - Payment method management

3. **Checkout Flow**
   - Stripe Elements integration
   - Razorpay checkout
   - Success/cancel handling

### Plan Structure
| Plan | Messages | Price (USD) | Price (INR) | Features |
|------|----------|-------------|-------------|----------|
| Free | 100/mo | $0 | ₹0 | Basic channels |
| Starter | 5,000/mo | $19 | ₹1,499 | All channels, basic support |
| Growth | 50,000/mo | $49 | ₹3,999 | API access, webhooks |
| Agency | Unlimited | $199 | ₹14,999 | White-label, priority support |

---

## 🎛️ Phase 2: Admin Dashboard Core (Weeks 4-6)
**Goal**: CEO-level control panel for platform management

### Database Schema
```prisma
model AdminAction {
  id          String   @id @default(cuid())
  adminId     String
  action      String   // suspend_user, reset_quota, etc.
  targetType  String   // user, campaign, etc.
  targetId    String
  reason      String?
  metadata    String?  // JSON
  createdAt   DateTime @default(now())
  
  @@map("admin_actions")
}

model SystemSetting {
  key         String   @id
  value       String
  category    String   // billing, security, email
  updatedAt   DateTime @updatedAt
  updatedBy   String?
  
  @@map("system_settings")
}
```

### Backend Tasks
1. **Admin Middleware**
   - Role-based access control (RBAC)
   - Admin-only API protection

2. **Admin Analytics APIs**
   - `/admin/analytics/users` - Signups, retention, churn
   - `/admin/analytics/messages` - Volume, success rates
   - `/admin/analytics/revenue` - MRR, ARR, breakdown
   - `/admin/analytics/system` - Queue health, latency

3. **User Management APIs**
   - `/admin/users` - List with filters
   - `/admin/users/:id/impersonate` - Login as user
   - `/admin/users/:id/suspend` - Suspend/unsuspend
   - `/admin/users/:id/reset-quota` - Manual quota reset
   - `/admin/users/:id/delete` - GDPR-compliant delete

4. **Payment Gateway Admin APIs**
   - `/admin/gateways` - CRUD operations
   - `/admin/gateways/:id/test` - Test credentials
   - `/admin/gateways/:id/toggle` - Enable/disable

### Frontend Tasks
1. **Admin Layout** (`/admin`)
   - Sidebar navigation
   - Admin-only route protection
   - Quick stats header

2. **Admin Dashboard** (`/admin/dashboard`)
   - KPI cards (Users, MRR, Messages, Churn)
   - Real-time charts (Recharts/Tremor)
   - System health indicators

3. **User Management** (`/admin/users`)
   - Data table with search/filters
   - User detail drawer
   - Bulk actions toolbar
   - "Login as User" button

4. **Analytics Pages**
   - `/admin/analytics/users` - Growth, retention, cohorts
   - `/admin/analytics/messages` - Volume by channel
   - `/admin/analytics/revenue` - Revenue charts
   - `/admin/analytics/system` - Server metrics

5. **Settings Pages**
   - `/admin/settings/gateways` - Payment configuration
   - `/admin/settings/plans` - Plan editor
   - `/admin/settings/security` - Abuse rules

---

## 📬 Phase 3: Advanced Campaign Features (Weeks 7-9)
**Goal**: Smart delivery + workflow automation

### Database Schema
```prisma
model Workflow {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  status      WorkflowStatus @default(DRAFT)
  trigger     String   // contact_tagged, message_received, time_based
  nodes       String   // JSON - workflow definition
  edges       String   // JSON - connections
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  runs        WorkflowRun[]
  
  @@map("workflows")
}

model WorkflowRun {
  id          String   @id @default(cuid())
  workflowId  String
  status      RunStatus @default(RUNNING)
  triggerData String   // JSON - what triggered it
  currentNode String?  // Current node ID
  startedAt   DateTime @default(now())
  completedAt DateTime?
  logs        String[] // Execution logs
  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  
  @@map("workflow_runs")
}

model WarmupConfig {
  id          String   @id @default(cuid())
  userId      String   @unique
  isActive    Boolean  @default(false)
  currentDay  Int      @default(1)
  dailyLimit  Int      @default(10)  // Starts low
  maxLimit    Int      @default(100) // Target limit
  incrementBy Int      @default(5)   // Daily increment
  messagesToday Int    @default(0)
  lastResetAt DateTime @default(now())
  
  @@map("warmup_configs")
}

model AntiBanLog {
  id          String   @id @default(cuid())
  userId      String
  channel     Channel
  action      String   // delay_applied, campaign_paused, etc.
  reason      String
  metadata    String?  // JSON
  createdAt   DateTime @default(now())
  
  @@index([userId, createdAt])
  @@map("anti_ban_logs")
}
```

### Backend Tasks
1. **Smart Anti-Ban System**
   - Random delay generator (min/max per campaign)
   - Warm-up mode service (gradual sending)
   - Block detection (failed message patterns)
   - Auto-pause logic (failure rate thresholds)
   - Delay recommendation engine

2. **Workflow Engine**
   - Node-based execution system
   - Triggers: time-based, event-based, condition-based
   - Actions: send message, wait, condition, tag contact
   - Webhook actions for external integrations

3. **Contact Segmentation**
   - Advanced filtering API
   - Saved segments
   - Dynamic segment updates
   - Segment-based campaign targeting

4. **Enhanced Campaign Scheduler**
   - Timezone-aware scheduling
   - Recurring campaigns
   - A/B testing framework
   - Send time optimization

### Frontend Tasks
1. **Workflow Builder** (`/dashboard/workflows`)
   - React Flow canvas
   - Node palette (trigger, action, condition, delay)
   - Edge connections
   - Test execution mode

2. **Segment Builder** (`/dashboard/segments`)
   - Filter UI (conditions builder)
   - Preview segment size
   - Save/load segments

3. **Campaign Enhancements**
   - A/B test setup
   - Schedule calendar view
   - Anti-ban status indicators

4. **Warm-up Dashboard**
   - Progress visualization
   - Daily limit tracker
   - Recommendations

---

## 🤖 Phase 4: AI & Automation (Weeks 10-11)
**Goal**: AI-powered features for premium users

### Database Schema
```prisma
model AIUsage {
  id          String   @id @default(cuid())
  userId      String
  feature     String   // message_generation, template_suggestions
  tokensUsed  Int
  cost        Decimal  @db.Decimal(10, 4)
  createdAt   DateTime @default(now())
  
  @@map("ai_usage")
}

model AITemplate {
  id          String   @id @default(cuid())
  userId      String
  name        String
  content     String
  category    String   // welcome, follow_up, promotional
  channel     Channel
  aiGenerated Boolean  @default(true)
  performance Int      @default(0) // Click/reply rate
  createdAt   DateTime @default(now())
  
  @@map("ai_templates")
}
```

### Backend Tasks
1. **AI Integration**
   - OpenAI GPT-4 integration
   - Ollama support (self-hosted option)
   - Token usage tracking
   - Cost allocation per user

2. **AI Services**
   - Message template generator
   - Subject line optimizer (email)
   - Follow-up sequence creator
   - Tone/style customization
   - Personalization suggestions

3. **AI APIs**
   - `/ai/generate-template` - Generate message templates
   - `/ai/optimize` - Improve existing copy
   - `/ai/sequence` - Generate follow-up sequences
   - `/ai/suggestions` - Smart recommendations

### Frontend Tasks
1. **AI Assistant Panel**
   - Inline AI generation in campaign editor
   - Template library with AI-generated options
   - "Improve this message" button

2. **AI Settings** (`/dashboard/settings/ai`)
   - AI provider selection (OpenAI/Ollama)
   - API key configuration
   - Usage tracking

---

## 🌟 Phase 5: Premium Features & Scale (Weeks 12-14)
**Goal**: Million-dollar SaaS features

### Database Schema
```prisma
model InboxMessage {
  id          String   @id @default(cuid())
  userId      String
  contactId   String
  channel     Channel
  direction   String   // inbound, outbound
  content     String
  externalId  String?  // Provider message ID
  isRead      Boolean  @default(false)
  parentId    String?  // Thread ID
  receivedAt  DateTime @default(now())
  
  @@index([userId, receivedAt])
  @@map("inbox_messages")
}

model Team {
  id          String   @id @default(cuid())
  name        String
  ownerId     String   // User who created team
  plan        Plan
  seats       Int      @default(5)
  createdAt   DateTime @default(now())
  members     TeamMember[]
  
  @@map("teams")
}

model TeamMember {
  id          String   @id @default(cuid())
  teamId      String
  userId      String
  role        TeamRole @default(MEMBER)
  permissions String[] // Custom permissions
  joinedAt    DateTime @default(now())
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  @@unique([teamId, userId])
  @@map("team_members")
}

enum TeamRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

### Backend Tasks
1. **Omnichannel Inbox**
   - Unified message storage
   - Real-time message sync
   - Mark as read/unread
   - Thread-based conversations
   - Quick reply templates

2. **Team Collaboration**
   - Multi-user workspaces
   - Role-based permissions
   - Shared contacts/campaigns
   - Activity logs

3. **Advanced Security**
   - 2FA (TOTP)
   - IP allowlisting
   - Audit logs
   - Data retention policies

4. **White-Label Features** (Agency plan)
   - Custom domain support
   - Logo/branding customization
   - Client sub-accounts
   - Reseller commission tracking

### Frontend Tasks
1. **Unified Inbox** (`/dashboard/inbox`)
   - Message threads view
   - Channel filters
   - Real-time updates (WebSocket/SSE)
   - Quick reply composer

2. **Team Management** (`/dashboard/team`)
   - Member list with roles
   - Invite flow
   - Permission editor

3. **White-Label Settings** (Agency only)
   - Branding customization
   - Domain configuration
   - Client management

---

## 📈 Implementation Priority Matrix

### P0 - Must Have (Launch Blocking)
- [ ] Stripe payment integration
- [ ] Plan enforcement middleware
- [ ] Basic admin user management
- [ ] Usage tracking

### P1 - Critical (First Month)
- [ ] Razorpay integration (India)
- [ ] Admin analytics dashboard
- [ ] Anti-ban system
- [ ] Invoice generation

### P2 - Important (Months 2-3)
- [ ] Workflow automation
- [ ] Contact segmentation
- [ ] AI message generator
- [ ] Omnichannel inbox

### P3 - Nice to Have (Future)
- [ ] Team collaboration
- [ ] White-label features
- [ ] Advanced A/B testing
- [ ] Mobile app

---

## 🛠️ Technical Recommendations

### New Dependencies Needed
```json
{
  "stripe": "^14.x",
  "razorpay": "^2.x",
  "openai": "^4.x",
  "reactflow": "^11.x",
  "recharts": "^2.x",
  "date-fns": "^3.x",
  "speakeasy": "^2.x"
}
```

### Infrastructure
- **Redis**: Already configured ( BullMQ )
- **PostgreSQL**: Already configured
- **File Storage**: Add S3/R2 for invoice PDFs, media
- **Monitoring**: Add Sentry, LogRocket
- **Analytics**: Add Plausible/PostHog

### Security Checklist
- [ ] Encrypt all API keys at rest
- [ ] Webhook signature verification
- [ ] Rate limiting per user/plan
- [ ] Input sanitization
- [ ] SQL injection protection (Prisma ✅)
- [ ] XSS protection
- [ ] CSRF tokens

---

## 💰 Revenue Model Projections

### Monthly Revenue at Scale
| Users | Plan Mix | MRR Projection |
|-------|----------|----------------|
| 100 | 70% Free, 30% Paid | $2,000 |
| 500 | 60% Free, 40% Paid | $12,000 |
| 1,000 | 50% Free, 50% Paid | $30,000 |
| 5,000 | 40% Free, 60% Paid | $120,000 |

### Key Metrics to Track
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)
- Churn Rate
- NRR (Net Revenue Retention)
- MRR Growth Rate

---

## 🚀 Launch Strategy

### Pre-Launch (Week 1-2)
1. Beta testing with 10-20 users
2. Payment flow testing
3. Admin dashboard setup
4. Documentation

### Launch (Week 3)
1. ProductHunt launch
2. IndieHackers post
3. Reddit communities (r/SaaS, r/marketing)
4. LinkedIn outreach

### Post-Launch (Ongoing)
1. Weekly feature updates
2. Customer feedback loop
3. Case studies
4. Affiliate program

---

**Estimated Total Timeline: 14 weeks (3.5 months)**
**Team Size Recommended: 2-3 developers**

---

*Last Updated: February 2026*
*Next Review: After Phase 1 completion*

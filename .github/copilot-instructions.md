# Becastly AI Coding Instructions

## Project Overview
**Becastly** is a Multi-Channel Marketing SaaS platform supporting WhatsApp, Email, SMS (Twilio), and Telegram campaigns. Full-stack TypeScript: Fastify backend, Next.js frontend, Prisma ORM, PostgreSQL, Redis queues.

## Architecture & Key Patterns

### Module-First Structure
- **Location**: `src/modules/{auth,campaigns,contacts,integrations,api}/`
- **Pattern**: Each feature has `.routes.ts`, `.service.ts`, and domain logic
- **Export convention**: Routes export `async function <moduleName>Routes(fastify: FastifyInstance)`
- **Example**: [auth.routes.ts](src/modules/auth/auth.routes.ts#L4) registers POST `/login`, `/register`; GET `/me`

### Data Model & Migrations
- **Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Key entities**: User (plan, quota), Campaign (channel, status), Contact (tags, channels), Message (delivery tracking)
- **Patterns**: Soft deletes via `status` field; relationships use `onDelete: Cascade`
- **Workflow**: After schema changes, run `npm run db:migrate` then `npm run db:generate`

### Authentication & Authorization
- **Session-based** for web via Lucia + cookie middleware (see [app.ts](src/app.ts#L54))
- **API key** authentication via Bearer token in Authorization header
- **Public routes** hardcoded in hook: `/auth/*`, `/health`, `/webhooks/`
- **Validation**: Use [auth.ts](src/lib/auth.ts) utilities for protected endpoints

### Request/Response Patterns
- **Validation**: Zod schemas in each service (e.g., `registerSchema.parse(request.body)`)
- **Errors**: Catch errors, return `{ success: false, error: message }` with appropriate HTTP codes
- **Success**: Return `{ success: true, data: {...} }` structure
- **Multipart uploads**: Use `@fastify/multipart` plugin (registered in app setup)

### Background Jobs & Queues
- **Queue library**: BullMQ with Redis backend
- **Pattern**: [lib/queue.ts](src/lib/queue.ts) creates job queues
- **Worker**: [src/workers/campaign.worker.js](src/workers/campaign.worker.js) processes scheduled campaigns
- **Usage**: Enqueue jobs in service layer; worker runs separately (`npm run worker`)

## Development Workflow

### Local Setup
```bash
npm install
cp .env.example .env  # Edit: ENCRYPTION_KEY, APP_URL, NEXT_PUBLIC_API_URL
npm run db:migrate
npm run dev          # Runs backend on :3001
cd frontend && npm run dev  # Runs frontend on :3000
```

### Database
- **Prisma Studio**: `npm run db:studio` (visual DB explorer)
- **New migrations**: After schema change, `npm run db:migrate`
- **Codegen**: `npm run db:generate` (if Prisma client out of sync)

### Docker Production
- **Start**: `docker-compose up -d`
- **Migrate**: `docker-compose exec api npx prisma migrate deploy`
- **Logs**: `docker-compose logs -f api`

## Common Tasks

### Adding a New Campaign Channel
1. Extend `Channel` enum in [schema.prisma](prisma/schema.prisma)
2. Add integration config type in `IntegrationType`
3. Create `src/modules/channels/<channel>.service.ts` with send logic
4. Import & call from campaign worker (`campaign.worker.js`)
5. Test with dummy data using `npm run db:studio`

### Adding an Endpoint
1. Create handler in `src/modules/<module>/<module>.service.ts`
2. Add route in `src/modules/<module>/<module>.routes.ts` (follow error/success pattern)
3. Use Zod schema for input validation
4. If authenticated, check `request.user` or `request.apiUser` (set by auth hook)

### Environment & Secrets
- **Required**: `POSTGRES_PASSWORD`, `ENCRYPTION_KEY` (32-char hex), `APP_URL`, `NEXT_PUBLIC_API_URL`
- **Optional**: Provider tokens (`META_ACCESS_TOKEN`, `TWILIO_ACCOUNT_SID`, `TELEGRAM_BOT_TOKEN`, SMTP settings)
- **Encryption key**: Generate via `openssl rand -hex 32`

## Key Files Reference
- **Backend entry**: [src/app.ts](src/app.ts)
- **Frontend entry**: [frontend/app/](frontend/app/)  
- **Database schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Docker config**: [docker-compose.yml](docker-compose.yml)
- **API routes registration**: [src/app.ts](src/app.ts#L100) - see route imports

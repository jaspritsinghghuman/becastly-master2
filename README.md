# Becastly - Multi-Channel Marketing Platform

A powerful **multi-tenant** WhatsApp, Email, Telegram, and SMS marketing platform built with Next.js, Fastify, and Prisma.

## Features

- 📱 **Multi-Channel Support**: WhatsApp Business API, Email (SMTP), Telegram Bot, SMS (Twilio)
- 👥 **Contact Management**: Import, organize, and segment your contacts
- 📊 **Campaign Management**: Create, schedule, and track marketing campaigns
- 📈 **Analytics**: Real-time delivery tracking and campaign statistics
- 🏢 **Multi-Tenant**: Each organization (tenant) has isolated users, contacts, campaigns, and usage
- 🔐 **Secure**: JWT-based authentication (access + refresh tokens) with encrypted credentials
- 🛡️ **Compliance Sending Engine**: Randomized delays, daily quotas, and per-contact cooldowns to respect provider limits
- 🎨 **Modern UI**: Built with Tailwind CSS and shadcn/ui

## Quick Start

### One-Line Installation (Ubuntu 24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/jaspritsinghghuman/becastly/master/install-ubuntu24.sh | sudo bash
```

Or download and run manually:

```bash
# 1. Download the installer
wget https://raw.githubusercontent.com/jaspritsinghghuman/becastly/master/install-ubuntu24.sh

# 2. Make it executable
chmod +x install-ubuntu24.sh

# 3. Run it
sudo bash install-ubuntu24.sh
```

### Manual Installation

#### Prerequisites

- Ubuntu 22.04/24.04 or Debian 11/12
- Docker & Docker Compose
- Git

#### Step 1: Clone Repository

```bash
git clone https://github.com/jaspritsinghghuman/becastly-master2.git
cd becastly-master2
```

#### Step 2: Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your settings (see `.env.example` for full comments). At minimum:

```env
# Backend
DATABASE_URL=postgresql://username:password@postgres:5432/becastly
APP_URL=http://your-server-ip
API_PORT=3001
ENCRYPTION_KEY=$(openssl rand -hex 32)
REDIS_URL=redis://redis:6379

# JWT (auth)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
```

#### Step 3: Create Frontend Environment

```bash
echo "NEXT_PUBLIC_API_URL=http://your-server-ip" > frontend/.env.production
```

#### Step 4: Create Public Folder

```bash
mkdir -p frontend/public
touch frontend/public/.gitkeep
```

#### Step 5: Start Services

```bash
docker-compose up -d
```

#### Step 6: Run Database Migrations

```bash
docker-compose exec api npx prisma migrate deploy
```

#### Step 7: Access Application

Open http://your-server-ip/auth/register in your browser and create your account.

## Docker Deployment

### Build and Run

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Nginx | 80, 443 | Reverse proxy |
| Frontend | 3000 | Next.js application |
| API | 3001 | Fastify backend API |
| Worker | - | Background job processor |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & queues |

## Configuration

### Environment Variables

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/becastly` |
| `ENCRYPTION_KEY` | 32+ char key for encryption | `a1b2c3d4...` |
| `APP_URL` | Your server URL (frontend origin) | `http://10.0.0.5` |
| `API_PORT` | API port | `3001` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `JWT_SECRET` | JWT access-token secret | random 32+ chars |
| `JWT_REFRESH_SECRET` | JWT refresh-token secret | random 32+ chars |
| `NEXT_PUBLIC_API_URL` | API URL for browser (no /api suffix) | `http://10.0.0.5:3001` |

#### Optional (Integrations)

| Variable | Description |
|----------|-------------|
| `META_ACCESS_TOKEN` | WhatsApp Business API token |
| `META_PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `SMTP_HOST` | SMTP server host |

### SSL/HTTPS Setup

1. Place your certificates in `nginx/ssl/`:
   - `cert.pem` - Certificate
   - `key.pem` - Private key

2. Or use Certbot for Let's Encrypt (configured in docker-compose.yml)

## Troubleshooting

### "Failed to fetch" Error

If registration shows "Failed to fetch":

```bash
# 1. Check API URL in frontend
docker-compose exec frontend printenv | grep NEXT_PUBLIC

# 2. Should match your server IP, not localhost
# If wrong, rebuild:
echo "NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP" > frontend/.env.production
docker-compose stop frontend
docker-compose rm -f frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Database Connection Issues

```bash
# Check database status
docker-compose logs postgres

# Run migrations manually
docker-compose exec api npx prisma migrate deploy
```

### Port Already in Use

```bash
# Check what's using port 80
sudo netstat -tulpn | grep :80

# Stop conflicting service or change ports in docker-compose.yml
```

## Development

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Backend Development

```bash
npm install
npm run dev
```

## Project Structure

```
becastly/
├── frontend/          # Next.js frontend
│   ├── app/          # App router pages
│   ├── components/   # UI components
│   └── lib/          # Utilities & API client
├── src/              # Backend source
│   ├── routes/       # API routes
│   ├── services/     # Business logic
│   └── workers/      # Background workers
├── prisma/           # Database schema
├── nginx/            # Nginx configuration
├── docker-compose.yml
└── install-ubuntu24.sh  # One-click installer
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- 📧 Email: support@becastly.com
- 💬 Discord: [Join our community](https://discord.gg/becastly)
- 📖 Docs: [docs.becastly.com](https://docs.becastly.com)

# 🚀 Hostinger Business Plan Deployment Guide

Deploy Becastly on Hostinger Business Plan with Node.js support.

## 📋 Hostinger Requirements

- **Plan**: Business or higher (Node.js support)
- **Node.js Version**: 18.x, 20.x, 22.x, or 24.x
- **Domain**: Connected to your Hostinger account

## 🎯 Deployment Architecture

```
┌─────────────────────────────────────────┐
│           Hostinger Server              │
│                                         │
│  ┌─────────────┐    ┌─────────────┐    │
│  │  Frontend   │    │    API      │    │
│  │  (Next.js)  │    │  (Express)  │    │
│  │  :3000      │    │   :3001     │    │
│  └──────┬──────┘    └──────┬──────┘    │
│         │                  │           │
│         └────────┬─────────┘           │
│                  │                     │
│            ┌─────┴─────┐               │
│            │   Nginx   │               │
│            │ (Reverse) │               │
│            └─────┬─────┘               │
│                  │                     │
│            Public :80/:443             │
└─────────────────────────────────────────┘
```

## 🚀 Method 1: Using Hostinger hPanel (Easiest)

### Step 1: Prepare Your Code

1. **Update package.json for Hostinger:**

```json
{
  "name": "becastly",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc && cd frontend && npm run build",
    "start": "node hostinger-server.js",
    "postinstall": "npm run build"
  },
  "engines": {
    "node": "20.x"
  }
}
```

2. **Create `.htaccess` for routing:**

Create `public_html/.htaccess`:

```apache
RewriteEngine On
RewriteBase /

# Redirect HTTP to HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# API routes -> Node.js backend
RewriteRule ^api/(.*)$ http://localhost:3001/api/$1 [P,L]
RewriteRule ^auth/(.*)$ http://localhost:3001/auth/$1 [P,L]
RewriteRule ^contacts/(.*)$ http://localhost:3001/contacts/$1 [P,L]
RewriteRule ^campaigns/(.*)$ http://localhost:3001/campaigns/$1 [P,L]
RewriteRule ^integrations/(.*)$ http://localhost:3001/integrations/$1 [P,L]
RewriteRule ^webhooks/(.*)$ http://localhost:3001/webhooks/$1 [P,L]

# Frontend -> Next.js
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```

### Step 2: Upload to Hostinger

1. **Compress your project:**
```bash
# Exclude node_modules and .git
zip -r becastly.zip . -x "node_modules/*" ".git/*" "*.zip"
```

2. **Upload via hPanel:**
   - Go to **File Manager** in hPanel
   - Navigate to `public_html/`
   - Upload `becastly.zip`
   - Extract the zip file

### Step 3: Setup Node.js Application

1. In hPanel, go to **Advanced** → **Node.js**
2. Click **Create Application**
3. Configure:
   - **Node.js version**: 20.x
   - **Application root**: `public_html/`
   - **Application URL**: `your-domain.com`
   - **Application startup file**: `hostinger-server.js`
4. Click **Create**

### Step 4: Install Dependencies

1. In hPanel Node.js section, click **Run NPM Install**
2. Or via SSH:
```bash
cd ~/public_html
npm install
npm run build
```

### Step 5: Environment Variables

1. In hPanel Node.js section, click **Environment Variables**
2. Add your variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
ENCRYPTION_KEY=your_32_char_key
APP_URL=https://your-domain.com

# Channel credentials
META_ACCESS_TOKEN=
TWILIO_ACCOUNT_SID=
TELEGRAM_BOT_TOKEN=
SMTP_HOST=
```

### Step 6: Start Application

Click **Restart** in the Node.js section of hPanel.

---

## 🚀 Method 2: Using SSH (Full Control)

### Step 1: Enable SSH Access

1. In hPanel, go to **Advanced** → **SSH Access**
2. Enable SSH and note the credentials
3. Connect via SSH:

```bash
ssh u123456789@your-domain.com -p 65002
```

### Step 2: Setup Application

```bash
# Navigate to public_html
cd ~/public_html

# Clone your repository
git clone https://github.com/YOUR_USERNAME/becastly.git .

# Or upload files via SCP/FileZilla

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Build application
npm run build

# Setup environment
cp .env.example .env
nano .env  # Edit with your settings
```

### Step 3: Use PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start API
pm2 start hostinger-server.js --name becastly-api

# Start Frontend (if separate)
pm2 start frontend/server.js --name becastly-frontend

# Save PM2 config
pm2 save
pm2 startup
```

### Step 4: Setup Reverse Proxy

Create `public_html/.htaccess`:

```apache
RewriteEngine On

# Proxy to Node.js apps
RewriteRule ^api/(.*)$ http://localhost:3001/$1 [P,L]
RewriteRule ^auth/(.*)$ http://localhost:3001/auth/$1 [P,L]
RewriteRule ^contacts/(.*)$ http://localhost:3001/contacts/$1 [P,L]
RewriteRule ^campaigns/(.*)$ http://localhost:3001/campaigns/$1 [P,L]
RewriteRule ^integrations/(.*)$ http://localhost:3001/integrations/$1 [P,L]

# Frontend
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```

---

## 🗄️ Database Options

### Option 1: Hostinger MySQL (Modify for MySQL)

Hostinger provides MySQL, but Becastly uses PostgreSQL. You can:

1. Use **Hostinger VPS** instead for PostgreSQL
2. Or use **External PostgreSQL** (Railway, Supabase)

### Option 2: External PostgreSQL (Recommended)

**Railway PostgreSQL:**
```env
DATABASE_URL=postgresql://user:pass@containers.railway.app:5432/railway
```

**Supabase:**
```env
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
```

**Neon:**
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

### Option 3: Redis Alternative

Use **Upstash Redis** (free tier):
```env
REDIS_URL=rediss://default:pass@xxx.upstash.io:6379
```

---

## ⚙️ Configuration Files

### package.json (Hostinger version)

```json
{
  "name": "becastly",
  "version": "1.0.0",
  "description": "Multi-Channel Marketing SaaS",
  "main": "hostinger-server.js",
  "scripts": {
    "dev": "ts-node-dev src/app.ts",
    "build": "tsc && cd frontend && npm run build",
    "start": "node hostinger-server.js",
    "worker": "node dist/workers/campaign.worker.js",
    "postinstall": "prisma generate",
    "db:migrate": "prisma migrate deploy"
  },
  "engines": {
    "node": "20.x"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "ioredis": "^5.0.0",
    "axios": "^1.4.0",
    "nodemailer": "^6.9.0",
    "twilio": "^4.0.0",
    "papaparse": "^5.4.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/jsonwebtoken": "^9.0.0",
    "prisma": "^5.0.0",
    "typescript": "^5.0.0"
  }
}
```

### ecosystem.config.js (PM2)

```javascript
module.exports = {
  apps: [
    {
      name: 'becastly-api',
      script: './hostinger-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'becastly-worker',
      script: './dist/workers/campaign.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

---

## 🔧 Troubleshooting

### Node.js not starting

```bash
# Check logs in hPanel Node.js section
# Or via SSH:
tail -f ~/.logs/nodejs/nodejs.log
```

### Port already in use

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### Build fails

```bash
# Clear cache and rebuild
rm -rf node_modules
rm -rf frontend/node_modules
npm cache clean --force
npm install
npm run build
```

### Out of memory

In `ecosystem.config.js`:
```javascript
max_memory_restart: '512M'
```

Or upgrade to Hostinger Cloud Plan.

---

## 💰 Hostinger Plan Comparison

| Plan | Price | Node.js | Databases | Best For |
|------|-------|---------|-----------|----------|
| **Single** | $1.99/mo | ❌ No | 1 | Static sites |
| **Premium** | $2.99/mo | ❌ No | Unlimited | WordPress |
| **Business** | $3.99/mo | ✅ Yes | Unlimited | **Becastly** |
| **Cloud Startup** | $9.99/mo | ✅ Yes | Unlimited | High traffic |

---

## 📞 Support

- **Hostinger Support**: [support.hostinger.com](https://support.hostinger.com)
- **hPanel Guide**: [hostinger.com/tutorials/hpanel](https://www.hostinger.com/tutorials/hpanel)
- **Node.js Docs**: [hostinger.com/tutorials/how-to-install-node-js](https://www.hostinger.com/tutorials/how-to-install-node-js)

---

**Need help?** Check the Hostinger knowledge base or contact their 24/7 support!

# 🔧 Hostinger Business Plan - Fix Guide

## The Problem

Hostinger Business Plan's Node.js support expects:
- ✅ Next.js app (frontend)
- ✅ Express.js app (backend)
- ✅ Simple single-app structure

Becastly has:
- ❌ Fastify backend (not standard Express)
- ❌ Frontend in /frontend subfolder
- ❌ Multiple services (API + Worker)
- ❌ Complex structure

## 🎯 Solutions

### Solution 1: Deploy Frontend Only (Recommended)

Deploy **Next.js frontend** on Hostinger, host **API on Railway** (free).

**Step 1: Create Frontend-Only ZIP**

```bash
# Create a folder with only frontend
mkdir becastly-frontend
cp -r frontend/* becastly-frontend/
cp -r frontend/.* becastly-frontend/ 2>/dev/null || true

# Update API URL in becastly-frontend
# Edit: becastly-frontend/lib/api.ts
# Change: const API_URL = "https://your-railway-app.up.railway.app"

# Create ZIP
cd becastly-frontend
zip -r ../becastly-frontend.zip .
```

**Step 2: Upload to Hostinger**
1. Upload `becastly-frontend.zip` to `public_html/`
2. Extract it
3. In hPanel Node.js:
   - Root: `public_html/`
   - Startup: `server.js` (or `node_modules/next/dist/bin/next start`)

**Step 3: Deploy API on Railway**
```bash
# Push backend to Railway
git subtree push --prefix . railway main
# Or use Railway CLI
```

---

### Solution 2: Deploy API Only on Hostinger

Deploy **Express-compatible API** on Hostinger, use **Vercel** for frontend.

**Step 1: Modify for Express**

Create `hostinger-app.js`:
```javascript
const express = require('express');
const app = express();

// Your API routes here
app.get('/api/health', (req, res) => res.json({status: 'ok'}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API on port ${PORT}`));
```

**Step 2: Upload**
- Upload backend files
- Set startup: `hostinger-app.js`

**Step 3: Deploy Frontend on Vercel**
```bash
cd frontend
vercel --prod
```

---

### Solution 3: Full App on Hostinger VPS (Best Control)

If you want full control, **upgrade to Hostinger VPS** instead of Business Plan.

VPS gives you:
- Root access
- Docker support
- PostgreSQL installation
- Full Becastly deployment

**Cost**: Cloud VPS 1 (~$6/month)

---

### Solution 4: Simplified Monolithic App (Quick Fix)

Convert Becastly to a single Express app that Hostinger understands.

**Step 1: Install Express adapter**
```bash
npm install express
```

**Step 2: Create `index.js`**
```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve static files (frontend build)
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 3: Build and Upload**
```bash
# Build frontend
cd frontend && npm run build && cd ..

# Create ZIP
zip -r becastly.zip . -x "node_modules/*" ".git/*"
```

**Step 4: Upload to Hostinger**
- Upload to `public_html/`
- Set startup: `index.js`

---

## 🚀 Recommended Approach: Split Deployment

### Backend API → Railway (Free)
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select your repo
4. Add PostgreSQL and Redis
5. Deploy - get URL like `https://becastly-api.up.railway.app`

### Frontend → Hostinger Business
1. Update `frontend/lib/api.ts`:
```typescript
const API_URL = "https://becastly-api.up.railway.app";
```
2. Build: `cd frontend && npm run build`
3. Upload `frontend/` folder to Hostinger
4. Set Node.js startup: `server.js`

---

## 📋 Hostinger File Structure (What They Expect)

```
public_html/
├── package.json          # Must have "start" script
├── server.js             # Entry point
├── next.config.js        # If Next.js
├── .env                  # Environment variables
├── public/               # Static files
├── src/ or pages/        # Source code
└── node_modules/         # Dependencies
```

---

## ⚠️ Common Hostinger Errors

### "Unsupported framework"
- **Cause**: Missing package.json or wrong structure
- **Fix**: Ensure package.json has `"start": "node server.js"`

### "Invalid project structure"
- **Cause**: Multiple package.json files or wrong root
- **Fix**: Only one package.json at root, delete frontend/package.json or move frontend to root

### "Port already in use"
- **Cause**: Hardcoded port 3000
- **Fix**: Use `process.env.PORT || 3000`

### "Build failed"
- **Cause**: TypeScript not compiled
- **Fix**: Upload pre-built files or add build script

---

## 💡 Quick Fix: Working Example

Here's a structure that WILL work on Hostinger:

**1. Create `hostinger-package.json`:**
```json
{
  "name": "becastly",
  "version": "1.0.0",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@prisma/client": "^5.0.0"
  }
}
```

**2. Create `index.js`:**
```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Your routes here
app.get('/api', (req, res) => {
  res.json({ message: 'Becastly API' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**3. Upload this structure:**
```
becastly-hostinger.zip
├── package.json
├── index.js
└── .env
```

This will work 100% on Hostinger Business Plan!

---

## 🔄 My Recommendation

Since you already have Business Plan:

1. **Keep Business Plan for Frontend** (Next.js works great)
2. **Use Railway Free Tier for Backend API**
3. **Connect them together**

**Why?**
- Hostinger Business = Good for frontend hosting
- Railway Free = Perfect for backend API + database
- Total cost = $3.99/month (just Hostinger)
- Professional setup

---

**Want me to create the split deployment setup for you?**

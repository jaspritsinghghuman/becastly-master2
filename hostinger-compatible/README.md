# Becastly - Hostinger Compatible Version

This is a simplified version of Becastly that works with Hostinger Business Plan Node.js support.

## 📦 Files

- `index.js` - Main Express server
- `package.json` - Dependencies
- `.env.example` - Environment variables template

## 🚀 Quick Deploy

### 1. Create ZIP file

Zip these 3 files:
```
becastly-hostinger.zip
├── index.js
├── package.json
└── .env
```

### 2. Upload to Hostinger

1. Go to hPanel → File Manager
2. Navigate to `public_html/`
3. Upload the ZIP file
4. Extract it

### 3. Configure Node.js

In hPanel → Advanced → Node.js:
- **Node.js version**: 20.x
- **Application root**: `public_html/`
- **Application URL**: `your-domain.com`
- **Application startup file**: `index.js`

### 4. Environment Variables

In hPanel Node.js section, add:
```
PORT=3000
NODE_ENV=production
```

### 5. Start

Click "Restart" in the Node.js section.

## ✅ Test

Visit:
- `https://your-domain.com/health` - Should show `{"status":"ok"}`
- `https://your-domain.com/api` - API info

## 📝 Notes

This is a **simplified API** for Hostinger compatibility. For full features:
- Use **VPS** for complete Becastly
- Or split: Frontend on Hostinger, API on Railway

#!/bin/bash

# Hostinger Deployment Script
# Run this on your Hostinger server via SSH

set -e

echo "🚀 Becastly Hostinger Deployment"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
APP_DIR="$HOME/public_html"
NODE_VERSION="20"

echo ""
echo -e "${YELLOW}📁 Setting up in: $APP_DIR${NC}"

# Navigate to app directory
cd $APP_DIR

# Check if this is first deploy
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}📥 First deployment - cloning repository...${NC}"
    
    # Backup existing files
    if [ -f "index.html" ]; then
        mkdir -p backup
        mv * backup/ 2>/dev/null || true
        mv .* backup/ 2>/dev/null || true
    fi
    
    echo -e "${RED}⚠️  Please upload your files or clone from GitHub${NC}"
    echo "Run: git clone https://github.com/YOUR_USERNAME/becastly.git ."
    exit 1
fi

echo -e "${GREEN}✅ Files found${NC}"

# Check Node.js version
echo -e "${YELLOW}🟢 Checking Node.js version...${NC}"
node -v
npm -v

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --production

# Install frontend dependencies
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd frontend
npm ci
npm run build
cd ..

# Generate Prisma client
echo -e "${YELLOW}🗄️  Generating Prisma client...${NC}"
npx prisma generate

# Run migrations (optional - be careful with production!)
# echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
# npx prisma migrate deploy

# Setup PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Start/Restart application
echo -e "${YELLOW}🚀 Starting application with PM2...${NC}"
pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js

# Save PM2 config
pm2 save

echo ""
echo -e "${GREEN}🎉 Deployment completed!${NC}"
echo ""
echo "📋 Application Status:"
pm2 status

echo ""
echo "📊 View logs:"
echo "  API logs:    pm2 logs becastly-api"
echo "  Worker logs: pm2 logs becastly-worker"
echo ""
echo "🔄 Useful commands:"
echo "  Restart:     pm2 restart all"
echo "  Stop:        pm2 stop all"
echo "  Monitor:     pm2 monit"
echo ""

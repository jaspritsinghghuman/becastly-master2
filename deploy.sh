#!/bin/bash

# Becastly VPS Deployment Script
# Run this on your VPS server

set -e

echo "🚀 Becastly Deployment Script"
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   exit 1
fi

# Configuration
DOMAIN=${1:-""}
EMAIL=${2:-""}

if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}⚠️  Usage: ./deploy.sh your-domain.com your-email@example.com${NC}"
    echo "Example: ./deploy.sh app.becastly.com admin@becastly.com"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Email is required for SSL certificate${NC}"
    exit 1
fi

echo ""
echo "📋 Configuration:"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo ""

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Install Docker Compose
echo -e "${YELLOW}🐳 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# Install Certbot
echo -e "${YELLOW}🔒 Installing Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot
    echo -e "${GREEN}✅ Certbot installed${NC}"
else
    echo -e "${GREEN}✅ Certbot already installed${NC}"
fi

# Create app directory
echo -e "${YELLOW}📁 Creating app directory...${NC}"
APP_DIR="$HOME/becastly"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone repository (if not exists)
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    git clone https://github.com/YOUR_USERNAME/becastly.git .
fi

# Generate encryption key
echo -e "${YELLOW}🔑 Generating encryption key...${NC}"
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Create environment file
echo -e "${YELLOW}📝 Creating environment file...${NC}"
cat > .env << EOF
# Database Configuration
POSTGRES_USER=becastly
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=becastly

# Application
NODE_ENV=production
API_PORT=3001
APP_URL=https://$DOMAIN

# Security
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Channel credentials (add these manually)
META_WEBHOOK_TOKEN=
META_ACCESS_TOKEN=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TELEGRAM_BOT_TOKEN=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EOF

echo -e "${GREEN}✅ Environment file created${NC}"

# Create SSL directory
echo -e "${YELLOW}🔒 Setting up SSL...${NC}"
mkdir -p nginx/ssl

# Generate self-signed certificate temporarily
echo -e "${YELLOW}⏳ Generating temporary SSL certificate...${NC}"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Becastly/CN=$DOMAIN"

# Start containers
echo -e "${YELLOW}🚀 Starting containers...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker-compose exec -T api npx prisma migrate deploy

echo -e "${GREEN}✅ Database migrations completed${NC}"

# Obtain SSL certificate
echo -e "${YELLOW}🔒 Obtaining SSL certificate from Let's Encrypt...${NC}"
sudo certbot certonly --standalone -d $DOMAIN --agree-tos -m $EMAIL --non-interactive

# Copy certificates
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem
sudo chown $USER:$USER nginx/ssl/*.pem

# Reload nginx
echo -e "${YELLOW}🔄 Reloading Nginx with SSL...${NC}"
docker-compose exec nginx nginx -s reload

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📋 Next steps:"
echo "  1. Update your DNS to point $DOMAIN to this server"
echo "  2. Edit .env file to add your channel credentials (WhatsApp, Email, etc.)"
echo "  3. Restart services: docker-compose restart"
echo "  4. Access your app at: https://$DOMAIN"
echo ""
echo "📚 Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  View API logs:    docker-compose logs -f api"
echo "  View worker logs: docker-compose logs -f worker"
echo "  Restart all:      docker-compose restart"
echo "  Update app:       docker-compose pull && docker-compose up -d"
echo "  Backup database:  docker-compose exec postgres pg_dump -U becastly becastly > backup.sql"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save your encryption key!${NC}"
echo "Encryption Key: $ENCRYPTION_KEY"
echo "Store this safely - you need it to decrypt integration credentials!"

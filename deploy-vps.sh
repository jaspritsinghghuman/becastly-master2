#!/bin/bash

# Becastly Hostinger VPS Deployment Script
# Run this on your Hostinger VPS (Ubuntu 22.04)

set -e

echo "🚀 Becastly VPS Deployment Script"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${1:-""}
EMAIL=${2:-""}

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Usage: ./deploy-vps.sh your-domain.com your-email@example.com${NC}"
    echo "Example: ./deploy-vps.sh app.becastly.com admin@becastly.com"
    exit 1
fi

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${YELLOW}⚠️  Running as root. Will create 'becastly' user...${NC}"
   
   # Create user if doesn't exist
   if ! id "becastly" &>/dev/null; then
       adduser --disabled-password --gecos "" becastly
       usermod -aG sudo becastly
       echo "becastly ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
   fi
   
   echo -e "${GREEN}✅ User 'becastly' created/updated${NC}"
   echo -e "${YELLOW}⚠️  Please switch to becastly user and run again:${NC}"
   echo "  su - becastly"
   echo "  ./deploy-vps.sh $DOMAIN $EMAIL"
   exit 0
fi

echo -e "${YELLOW}📦 Step 1/10: Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

echo -e "${YELLOW}📦 Step 2/10: Installing essential tools...${NC}"
sudo apt install -y curl wget git nano ufw fail2ban openssl

echo -e "${YELLOW}🐳 Step 3/10: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

echo -e "${YELLOW}🐳 Step 4/10: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

echo -e "${YELLOW}🔒 Step 5/10: Configuring firewall...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
echo -e "${GREEN}✅ Firewall configured${NC}"

echo -e "${YELLOW}📁 Step 6/10: Setting up application...${NC}"
APP_DIR="$HOME/becastly"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone if not exists
if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/jaspritsinghghuman/becastly.git .
fi

echo -e "${GREEN}✅ Application directory ready${NC}"

echo -e "${YELLOW}⚙️  Step 7/10: Generating configuration...${NC}"

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Create .env file if not exists
if [ ! -f ".env" ]; then
    cat > .env << EOF
# Database Configuration
POSTGRES_USER=becastly
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=becastly

# Application
NODE_ENV=production
API_PORT=3001
APP_URL=https://$DOMAIN

# Security
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Domain
DOMAIN=$DOMAIN

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
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

echo -e "${YELLOW}🚀 Step 8/10: Building and starting containers...${NC}"
docker-compose up -d --build

echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

echo -e "${YELLOW}🗄️  Step 9/10: Running database migrations...${NC}"
docker-compose exec -T api npx prisma migrate deploy || echo -e "${YELLOW}⚠️  Migration may have already been applied${NC}"

echo -e "${YELLOW}🔒 Step 10/10: Setting up SSL certificate...${NC}"
sudo apt install -y certbot

# Check if certbot succeeded
if sudo certbot certonly --standalone -d $DOMAIN --agree-tos -m $EMAIL --non-interactive; then
    # Copy certificates
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem
    sudo chown $USER:$USER nginx/ssl/*.pem
    
    # Reload nginx
    docker-compose exec nginx nginx -s reload
    echo -e "${GREEN}✅ SSL certificate installed${NC}"
else
    echo -e "${YELLOW}⚠️  SSL certificate setup failed. You can retry later with:${NC}"
    echo "  sudo certbot certonly --standalone -d $DOMAIN"
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "==========================================="
echo "📋 IMPORTANT INFORMATION"
echo "==========================================="
echo ""
echo "🌐 Your app should be available at:"
echo "   https://$DOMAIN"
echo ""
echo "📊 Check status:"
echo "   docker-compose ps"
echo ""
echo "📜 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🔑 Encryption Key (SAVE THIS!):"
echo "   $ENCRYPTION_KEY"
echo ""
echo "🗄️  Database Password (SAVE THIS!):"
echo "   $POSTGRES_PASSWORD"
echo ""
echo "==========================================="
echo ""
echo "📚 Useful commands:"
echo "  cd ~/becastly"
echo "  docker-compose logs -f        # View all logs"
echo "  docker-compose restart        # Restart all services"
echo "  docker-compose restart api    # Restart API only"
echo "  ./backup.sh                   # Backup database"
echo ""
echo "⚠️  Next steps:"
echo "  1. Point your domain DNS to this server IP"
echo "  2. Edit .env to add your channel credentials"
echo "  3. Restart: docker-compose restart"
echo ""
echo -e "${YELLOW}💾 Save the encryption key and database password shown above!${NC}"

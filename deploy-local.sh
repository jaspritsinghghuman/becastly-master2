#!/bin/bash

# Becastly Local Server Deployment Script
# For Ubuntu server at 10.10.0.55 or any local IP

set -e

echo "🏠 Becastly Local Server Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo -e "${BLUE}📍 Detected Local IP: $LOCAL_IP${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${YELLOW}⚠️  Running as root. It's recommended to use a regular user with sudo.${NC}"
   read -p "Continue as root? (y/N): " -n 1 -r
   echo
   if [[ ! $REPLY =~ ^[Yy]$ ]]; then
       exit 1
   fi
fi

echo -e "${YELLOW}📦 Step 1/8: Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

echo -e "${YELLOW}📦 Step 2/8: Installing essential tools...${NC}"
sudo apt install -y curl wget git nano net-tools

echo -e "${YELLOW}🐳 Step 3/8: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm -f get-docker.sh
    echo -e "${GREEN}✅ Docker installed${NC}"
    echo -e "${YELLOW}⚠️  Please log out and back in for Docker permissions to take effect${NC}"
    echo "   Then run this script again."
    exit 0
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

echo -e "${YELLOW}🐳 Step 4/8: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

echo -e "${YELLOW}📁 Step 5/8: Setting up application...${NC}"
APP_DIR="$HOME/becastly"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone if not exists
if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/jaspritsinghghuman/becastly.git .
fi

echo -e "${GREEN}✅ Application ready${NC}"

echo -e "${YELLOW}⚙️  Step 6/8: Generating configuration...${NC}"

# Generate keys
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
APP_URL=http://$LOCAL_IP

# Security
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Local server settings
LOCAL_IP=$LOCAL_IP

# Channel credentials (add these manually if needed)
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
    # Update APP_URL with current IP
    sed -i "s|APP_URL=.*|APP_URL=http://$LOCAL_IP|" .env
fi

# Create local docker-compose override if not exists
if [ ! -f "docker-compose.local.yml" ]; then
    cat > docker-compose.local.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: becastly-db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-becastly}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-becastly}
      POSTGRES_DB: ${POSTGRES_DB:-becastly}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - becastly-network

  redis:
    image: redis:7-alpine
    container_name: becastly-redis
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - becastly-network

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: becastly-api
    restart: always
    environment:
      - NODE_ENV=production
      - API_PORT=3001
      - DATABASE_URL=postgresql://${POSTGRES_USER:-becastly}:${POSTGRES_PASSWORD:-becastly}@postgres:5432/${POSTGRES_DB:-becastly}
      - REDIS_URL=redis://redis:6379
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - APP_URL=${APP_URL:-http://localhost}
    ports:
      - "3001:3001"
    networks:
      - becastly-network

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: becastly-worker
    restart: always
    command: npm run worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${POSTGRES_USER:-becastly}:${POSTGRES_PASSWORD:-becastly}@postgres:5432/${POSTGRES_DB:-becastly}
      - REDIS_URL=redis://redis:6379
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    networks:
      - becastly-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: becastly-frontend
    restart: always
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://${LOCAL_IP:-localhost}:3001
    ports:
      - "80:3000"
    networks:
      - becastly-network

volumes:
  postgres_data:
  redis_data:

networks:
  becastly-network:
    driver: bridge
EOF
    echo -e "${GREEN}✅ Local docker-compose created${NC}"
fi

echo -e "${YELLOW}🚀 Step 7/8: Building and starting containers...${NC}"
docker-compose -f docker-compose.local.yml up -d --build

echo -e "${YELLOW}⏳ Waiting for services to start (30s)...${NC}"
sleep 30

echo -e "${YELLOW}🗄️  Step 8/8: Running database migrations...${NC}"
docker-compose -f docker-compose.local.yml exec -T api npx prisma migrate deploy || echo -e "${YELLOW}⚠️  Migration may have already been applied${NC}"

echo ""
echo -e "${GREEN}🎉 Local deployment completed!${NC}"
echo ""
echo "==========================================="
echo "🌐 ACCESS YOUR APP"
echo "==========================================="
echo ""
echo "From this server:"
echo "   http://localhost"
echo "   http://localhost:3001 (API)"
echo ""
echo "From other devices on your network:"
echo "   http://$LOCAL_IP"
echo "   http://$LOCAL_IP:3001 (API)"
echo ""
echo "==========================================="
echo ""
echo "📊 Check status:"
echo "   docker-compose -f docker-compose.local.yml ps"
echo ""
echo "📜 View logs:"
echo "   docker-compose -f docker-compose.local.yml logs -f"
echo ""
echo "🔑 Encryption Key (SAVE THIS):"
echo "   $ENCRYPTION_KEY"
echo ""
echo "🗄️  Database Password (SAVE THIS):"
echo "   $POSTGRES_PASSWORD"
echo ""
echo "==========================================="

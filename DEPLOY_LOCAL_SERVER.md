# 🏠 Local Server Deployment Guide (Ubuntu)

Deploy Becastly on your local server at `10.10.0.55`

## 📋 Prerequisites

- **Server IP**: 10.10.0.55 (or your local IP)
- **OS**: Ubuntu 20.04/22.04 LTS
- **RAM**: 2 GB minimum
- **Storage**: 20 GB available
- **Network**: Local network access
- **SSH Access**: Enabled

## 🚀 Quick Deploy (Automated)

### Step 1: Connect to Your Local Server

```bash
# From any computer on the same network
ssh user@10.10.0.55

# Or if you're on the server directly, open terminal
```

### Step 2: Download and Run Deploy Script

```bash
# Download the deployment script
curl -fsSL https://raw.githubusercontent.com/jaspritsinghghuman/becastly/main/deploy-local.sh -o deploy-local.sh
chmod +x deploy-local.sh

# Run deployment (for local server, no domain needed)
./deploy-local.sh
```

Or run the VPS script with local flag:
```bash
./deploy-vps.sh local local@localhost
```

### Step 3: Access Becastly

After deployment, access at:
- **HTTP**: http://10.10.0.55
- **API**: http://10.10.0.55:3001

## 🔧 Manual Deployment

### Step 1: Update System

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y curl wget git nano
```

### Step 2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

### Step 3: Clone Repository

```bash
# Create app directory
mkdir -p ~/becastly
cd ~/becastly

# Clone repo
git clone https://github.com/jaspritsinghghuman/becastly.git .
```

### Step 4: Configure for Local Network

```bash
# Create environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Set these values for local deployment:**
```env
# Database
POSTGRES_USER=becastly
POSTGRES_PASSWORD=your_local_password
POSTGRES_DB=becastly

# Application
NODE_ENV=production
API_PORT=3001
APP_URL=http://10.10.0.55

# Security - Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your_32_character_key_here

# Local server doesn't need SSL certs for internal use
# If you want HTTPS locally, use self-signed or local CA
```

### Step 5: Modify Docker Compose for Local

Create `docker-compose.local.yml`:

```yaml
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
      - APP_URL=${APP_URL:-http://10.10.0.55}
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
      - NEXT_PUBLIC_API_URL=http://10.10.0.55:3001
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
```

### Step 6: Start Services

```bash
cd ~/becastly

# Start with local config
docker-compose -f docker-compose.local.yml up -d

# Run migrations
docker-compose -f docker-compose.local.yml exec api npx prisma migrate deploy

# Check status
docker-compose -f docker-compose.local.yml ps
```

### Step 7: Access the App

From any device on your network:
- **Web App**: http://10.10.0.55
- **API**: http://10.10.0.55:3001
- **Health Check**: http://10.10.0.55:3001/health

## 🌐 Access from Other Devices

### On Same Network

Any device connected to the same network can access:
```
http://10.10.0.55
```

### Port Forwarding (External Access)

To access from outside your network:

1. **Router Port Forwarding**:
   - External Port: 80 → Internal: 10.10.0.55:80
   - External Port: 3001 → Internal: 10.10.0.55:3001

2. **Get Public IP**:
   ```bash
   curl ifconfig.me
   ```

3. **Access via Public IP**:
   ```
   http://YOUR_PUBLIC_IP
   ```

⚠️ **Security Warning**: Opening ports to internet requires proper security (firewall, SSL, strong passwords).

## 🔒 Local Security

### Firewall (UFW)

```bash
# Allow local network only (10.10.0.0/24)
sudo ufw allow from 10.10.0.0/24 to any port 80
sudo ufw allow from 10.10.0.0/24 to any port 3001
sudo ufw allow from 10.10.0.0/24 to any port 22

# Or allow specific IPs
sudo ufw allow from 10.10.0.100 to any port 80

# Enable firewall
sudo ufw enable
```

### Self-Signed SSL (Optional)

For HTTPS on local network:

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/local-key.pem \
  -out nginx/ssl/local-cert.pem \
  -subj "/C=US/ST=Local/L=Local/O=Becastly/CN=10.10.0.55"

# Update docker-compose to use port 443
```

## 📊 Monitoring Local Server

### Check Server Resources

```bash
# CPU & Memory
htop

# Disk usage
df -h

# Memory usage
free -h

# Docker stats
docker stats
```

### View Logs

```bash
cd ~/becastly

# All services
docker-compose -f docker-compose.local.yml logs -f

# Specific service
docker-compose -f docker-compose.local.yml logs -f api
docker-compose -f docker-compose.local.yml logs -f worker
```

## 🔄 Auto-Start on Boot

### Enable Docker Auto-Start

```bash
# Docker starts automatically on boot
sudo systemctl enable docker

# Your containers will restart automatically if configured with 'restart: always'
```

### Create Systemd Service (Optional)

Create `/etc/systemd/system/becastly.service`:

```ini
[Unit]
Description=Becastly Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/becastly
ExecStart=/usr/local/bin/docker-compose -f docker-compose.local.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.local.yml down

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable becastly
sudo systemctl start becastly
```

## 💾 Backup Local Data

```bash
# Create backup script
cat > ~/backup-local.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups/becastly"
mkdir -p $BACKUP_DIR
date=$(date +%Y%m%d_%H%M%S)

# Backup database
cd ~/becastly
docker-compose -f docker-compose.local.yml exec -T postgres pg_dump -U becastly becastly | gzip > "$BACKUP_DIR/db_$date.sql.gz"

# Backup .env
cp .env "$BACKUP_DIR/env_$date"

echo "Backup completed: $BACKUP_DIR"
ls -lh $BACKUP_DIR
EOF

chmod +x ~/backup-local.sh

# Run backup
~/backup-local.sh
```

##  Troubleshooting

### Can't access from other devices

```bash
# Check firewall
sudo ufw status

# Check if ports are listening
sudo netstat -tulpn | grep -E ':(80|3001)'

# Check Docker containers
docker-compose -f docker-compose.local.yml ps

# Check server IP
ip addr show
```

### Container fails to start

```bash
# View logs
docker-compose -f docker-compose.local.yml logs

# Rebuild
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up -d --build
```

### Database connection error

```bash
# Check postgres is running
docker-compose -f docker-compose.local.yml ps postgres

# Access database
docker-compose -f docker-compose.local.yml exec postgres psql -U becastly -d becastly
```

## 🎯 Use Cases for Local Deployment

1. **Internal Company Tool** - Marketing team only
2. **Development/Testing** - Before production deploy
3. **Demo Environment** - Show clients without internet
4. **Data Privacy** - Keep data on-premise
5. **Cost Savings** - No cloud hosting fees

## 📋 Comparison: Local vs VPS vs Cloud

| Feature | Local Server | VPS | Cloud |
|---------|--------------|-----|-------|
| **Cost** | Hardware only | $7-15/month | $10-50/month |
| **Internet** | Not required | Required | Required |
| **Access** | Local network | Global | Global |
| **Maintenance** | You manage | Provider manages | Provider manages |
| **Best For** | Internal use | Production | Scale |

---

**Your Becastly is now running on local server at http://10.10.0.55!** 🎉

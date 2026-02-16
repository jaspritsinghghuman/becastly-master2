# 🚀 VPS + Docker Compose Deployment Guide

This guide walks you through deploying Becastly on a VPS using Docker Compose.

## 📋 Prerequisites

- VPS with **Ubuntu 22.04 LTS** (or similar)
- **2 GB RAM** minimum (4 GB recommended)
- **20 GB SSD** storage
- **Domain name** pointing to your VPS IP
- **Root or sudo access**

## 🛒 Recommended VPS Providers

| Provider | Plan | Cost | Link |
|----------|------|------|------|
| **Hetzner** | CX21 (2 vCPU, 4 GB RAM) | €5.35/month | [hetzner.com](https://www.hetzner.com/cloud) |
| **DigitalOcean** | Basic (2 vCPU, 2 GB RAM) | $12/month | [digitalocean.com](https://www.digitalocean.com) |
| **Linode** | Nanode (1 vCPU, 1 GB RAM) | $5/month | [linode.com](https://www.linode.com) |
| **AWS Lightsail** | 2GB RAM | $10/month | [lightsail.aws.amazon.com](https://lightsail.aws.amazon.com) |

## 🚀 Quick Deploy (Automated)

### 1. Setup VPS

```bash
# SSH into your VPS
ssh root@YOUR_SERVER_IP

# Create a non-root user (recommended)
adduser becastly
usermod -aG sudo becastly
su - becastly

# Install git
sudo apt update && sudo apt install -y git
```

### 2. Run Deploy Script

```bash
# Download deploy script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/becastly/main/deploy.sh -o deploy.sh
chmod +x deploy.sh

# Run deployment
./deploy.sh your-domain.com your-email@example.com
```

### 3. Configure DNS

Point your domain to your VPS IP:
- **A Record**: `your-domain.com` → `YOUR_SERVER_IP`
- **A Record**: `www.your-domain.com` → `YOUR_SERVER_IP` (optional)

## 🔧 Manual Deploy (Step-by-Step)

### 1. Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2. Clone Repository

```bash
# Create app directory
mkdir -p ~/becastly
cd ~/becastly

# Clone your repository
git clone https://github.com/YOUR_USERNAME/becastly.git .
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.production .env

# Edit configuration
nano .env
```

**Required changes:**
```env
# Change these
POSTGRES_PASSWORD=your_secure_password_here
ENCRYPTION_KEY=$(openssl rand -hex 32)  # Generate with this command
APP_URL=https://your-domain.com

# Add your channel credentials (optional for testing)
META_ACCESS_TOKEN=your_whatsapp_token
TWILIO_ACCOUNT_SID=your_twilio_sid
TELEGRAM_BOT_TOKEN=your_bot_token
SMTP_USER=your_email
SMTP_PASS=your_password
```

### 4. Setup SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com

# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
sudo chown $USER:$USER nginx/ssl/*.pem
```

### 5. Build and Start

```bash
# Build all containers
docker-compose build

# Start services
docker-compose up -d

# Run database migrations
docker-compose exec api npx prisma migrate deploy
```

### 6. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:3001/health
```

## 📊 Monitoring & Management

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100 api
```

### Manage Services

```bash
# Stop all services
docker-compose down

# Restart service
docker-compose restart api
docker-compose restart worker

# Update after code changes
docker-compose pull
docker-compose up -d --build

# Scale worker (run multiple workers)
docker-compose up -d --scale worker=3
```

### Database Operations

```bash
# Backup database
docker-compose exec postgres pg_dump -U becastly becastly > backup_$(date +%Y%m%d).sql

# Restore database
docker-compose exec -T postgres psql -U becastly becastly < backup_file.sql

# Access database shell
docker-compose exec postgres psql -U becastly -d becastly

# View database in Prisma Studio
docker-compose exec api npx prisma studio
```

### Redis Operations

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis
docker-compose exec redis redis-cli monitor

# Check queue status
docker-compose exec redis redis-cli llen bull:message:wait
```

## 🔒 Security Best Practices

### 1. Firewall Setup (UFW)

```bash
# Install UFW
sudo apt install -y ufw

# Configure
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Enable
sudo ufw enable

# Check status
sudo ufw status
```

### 2. Automatic Updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Configure
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 3. Fail2Ban (Intrusion Prevention)

```bash
# Install
sudo apt install -y fail2ban

# Start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Docker Security

```bash
# Run Docker Bench Security
docker run -it --net host --pid host --userns host --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /var/lib:/var/lib \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /usr/lib/systemd:/usr/lib/systemd \
  -v /etc:/etc --label docker_bench_security \
  docker/docker-bench-security
```

## 📈 Performance Tuning

### 1. System Limits

```bash
# Edit limits
sudo nano /etc/security/limits.conf

# Add:
* soft nofile 65536
* hard nofile 65536
```

### 2. Docker Resources

Edit `docker-compose.yml` to add resource limits:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 3. PostgreSQL Optimization

Create `postgres.conf`:

```conf
# Memory settings
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connection settings
max_connections = 100

# Logging
log_statement = 'mod'
log_duration = on
```

Mount in docker-compose:
```yaml
volumes:
  - ./postgres.conf:/etc/postgresql/postgresql.conf
```

## 🔄 CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to VPS
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USER }}
        key: ${{ secrets.VPS_SSH_KEY }}
        script: |
          cd ~/becastly
          git pull origin main
          docker-compose pull
          docker-compose up -d --build
          docker-compose exec -T api npx prisma migrate deploy
          docker-compose exec -T api npx prisma generate
```

Add secrets to GitHub:
- `VPS_HOST` - Your server IP
- `VPS_USER` - Server username
- `VPS_SSH_KEY` - Private SSH key

## 🆘 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs service_name

# Check port conflicts
sudo netstat -tulpn | grep 3000

# Restart with fresh build
docker-compose down
docker-compose up -d --build
```

### Database connection failed

```bash
# Check postgres is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Reset database (WARNING: deletes all data!)
docker-compose down -v
docker-compose up -d
docker-compose exec api npx prisma migrate deploy
```

### SSL certificate issues

```bash
# Renew certificate
sudo certbot renew

# Force renew
sudo certbot renew --force-renewal

# Copy new certificates
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem nginx/ssl/
docker-compose exec nginx nginx -s reload
```

### High memory usage

```bash
# Check memory usage
docker stats

# Restart services
docker-compose restart

# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📞 Support

- **GitHub Issues**: [github.com/YOUR_USERNAME/becastly/issues](https://github.com/YOUR_USERNAME/becastly/issues)
- **Documentation**: [README.md](README.md)
- **Docker Docs**: [docs.docker.com](https://docs.docker.com)

---

**Happy Deploying! 🚀**

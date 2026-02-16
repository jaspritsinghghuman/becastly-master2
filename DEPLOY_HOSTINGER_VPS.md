# 🚀 Hostinger VPS + Ubuntu 22.04 Deployment Guide

This is the **RECOMMENDED** way to deploy Becastly - full control, all features, Docker support!

## 📋 VPS Requirements

- **OS**: Ubuntu 22.04 LTS
- **RAM**: 2 GB minimum (4 GB recommended)
- **Storage**: 20 GB SSD
- **Plan**: Hostinger VPS 1 or higher

## 🎯 Why VPS is Better Than Business Plan

| Feature | Business Plan | VPS |
|---------|--------------|-----|
| Root Access | ❌ No | ✅ Yes |
| Docker | ❌ No | ✅ Yes |
| PostgreSQL | ❌ External only | ✅ Install locally |
| Redis | ❌ External only | ✅ Install locally |
| Multiple Apps | ❌ Limited | ✅ Unlimited |
| Full Becastly | ❌ Limited | ✅ Complete |

## 🛒 Setup Hostinger VPS

### Step 1: Order VPS

1. Go to [hostinger.com/vps](https://www.hostinger.com/vps-hosting)
2. Select **VPS 1** (2GB RAM, 20GB SSD) - $6.99/month
3. Choose **Ubuntu 22.04** as OS
4. Complete checkout

### Step 2: Get VPS Credentials

After purchase, Hostinger will email you:
- VPS IP Address
- Root Password
- SSH Port (usually 22)

### Step 3: Connect to VPS

**Windows (PowerShell):**
```powershell
ssh root@YOUR_VPS_IP
```

**Mac/Linux:**
```bash
ssh root@YOUR_VPS_IP
```

When prompted, enter the root password from the email.

## 🚀 Deploy Becastly on VPS

### Step 1: Initial Setup

```bash
# Update system
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git nano ufw fail2ban

# Create non-root user (recommended)
adduser becastly
usermod -aG sudo becastly
su - becastly
```

### Step 2: Install Docker & Docker Compose

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

# Clone your repo
git clone https://github.com/jaspritsinghghuman/becastly.git .
```

### Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**Required changes in `.env`:**
```env
# Change these
POSTGRES_PASSWORD=your_secure_password_here
ENCRYPTION_KEY=$(openssl rand -hex 32)  # Generate this
APP_URL=https://your-domain.com

# Add your domain
DOMAIN=your-domain.com
```

### Step 5: Setup Firewall

```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable

# Check status
sudo ufw status
```

### Step 6: Deploy with Docker Compose

```bash
cd ~/becastly

# Build and start all services
docker-compose up -d

# Run database migrations
docker-compose exec api npx prisma migrate deploy

# Check all services are running
docker-compose ps
```

### Step 7: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates to nginx
cd ~/becastly
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
sudo chown $USER:$USER nginx/ssl/*.pem

# Reload nginx
docker-compose exec nginx nginx -s reload
```

### Step 8: Configure Domain DNS

In your domain registrar (or Hostinger DNS):

```
Type: A
Name: @
Value: YOUR_VPS_IP
TTL: 3600

Type: A
Name: www
Value: YOUR_VPS_IP
TTL: 3600
```

Wait 5-10 minutes for DNS to propagate.

## 📊 Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# View logs
docker-compose logs -f

# Check API health
curl http://localhost:3001/health

# Test from outside
curl https://your-domain.com/health
```

## 🔧 Managing Your VPS

### Useful Commands

```bash
# View logs
docker-compose logs -f                # All services
docker-compose logs -f api            # API only
docker-compose logs -f worker         # Worker only
docker-compose logs -f nginx          # Nginx only

# Restart services
docker-compose restart                # All
docker-compose restart api            # API only
docker-compose restart worker         # Worker only

# Update after code changes
git pull origin main
docker-compose pull
docker-compose up -d --build

# Backup database
docker-compose exec postgres pg_dump -U becastly becastly > backup_$(date +%Y%m%d).sql

# Restore database
docker-compose exec -T postgres psql -U becastly becastly < backup_file.sql

# Access database
docker-compose exec postgres psql -U becastly -d becastly

# Monitor resources
docker stats
htop
```

### PM2 Alternative (without Docker)

If you prefer not using Docker:

```bash
# Install PM2
sudo npm install -g pm2

# Start services
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup

# Monitor
pm2 monit
pm2 logs
```

## 🔒 Security Hardening

### 1. Disable Root Login (SSH)

```bash
sudo nano /etc/ssh/sshd_config
```

Change:
```
PermitRootLogin no
PasswordAuthentication no  # Use SSH keys only
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### 2. Setup SSH Keys

**On your local machine:**
```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
ssh-copy-id becastly@YOUR_VPS_IP
```

### 3. Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 4. Fail2Ban (Block Brute Force)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 5. Docker Security

```bash
# Run Docker Bench Security
docker run -it --net host --pid host --cap-add audit_control \
  docker/docker-bench-security
```

## 📈 Monitoring

### Install Netdata (Free Monitoring)

```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

Access at: `http://YOUR_VPS_IP:19999`

### Basic Monitoring Script

Create `~/monitor.sh`:
```bash
#!/bin/bash
echo "=== Becastly Status ==="
echo ""
echo "Docker Containers:"
docker-compose ps
echo ""
echo "Disk Usage:"
df -h
echo ""
echo "Memory Usage:"
free -h
echo ""
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)"
```

Run: `bash ~/monitor.sh`

## 💰 Hostinger VPS Pricing

| Plan | RAM | CPU | Storage | Price | For Becastly |
|------|-----|-----|---------|-------|--------------|
| VPS 1 | 1 GB | 1 | 20 GB | $3.99/mo | ⚠️ Minimum |
| VPS 2 | 2 GB | 2 | 40 GB | $6.99/mo | ✅ Recommended |
| VPS 3 | 3 GB | 3 | 60 GB | $9.99/mo | ✅ Best |
| VPS 4 | 4 GB | 4 | 80 GB | $15.99/mo | 🚀 Scale |

**Recommended: VPS 2** for production use.

## 🆘 Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs service_name

# Rebuild
docker-compose down
docker-compose up -d --build
```

### Out of memory
```bash
# Add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### SSL certificate issues
```bash
# Renew
sudo certbot renew

# Force renew
sudo certbot renew --force-renewal

# Copy new certs
cd ~/becastly
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem nginx/ssl/
docker-compose exec nginx nginx -s reload
```

### Database connection failed
```bash
# Check postgres is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Reset (WARNING: deletes data!)
docker-compose down -v
docker-compose up -d
docker-compose exec api npx prisma migrate deploy
```

## 🔄 Automatic Deployment (CI/CD)

### GitHub Actions

Create `.github/workflows/deploy-vps.yml`:

```yaml
name: Deploy to Hostinger VPS

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
        host: ${{ secrets.VPS_IP }}
        username: ${{ secrets.VPS_USER }}
        key: ${{ secrets.VPS_SSH_KEY }}
        script: |
          cd ~/becastly
          git pull origin main
          docker-compose pull
          docker-compose up -d --build
          docker-compose exec -T api npx prisma migrate deploy
```

Add GitHub Secrets:
- `VPS_IP` - Your VPS IP
- `VPS_USER` - becastly
- `VPS_SSH_KEY` - Your SSH private key

## 📞 Support

- **Hostinger VPS Docs**: [hostinger.com/vps-tutorial](https://www.hostinger.com/tutorials/vps)
- **Becastly Issues**: [github.com/jaspritsinghghuman/becastly/issues](https://github.com/jaspritsinghghuman/becastly/issues)

---

**🎉 You're all set! Your complete Becastly app is running on Hostinger VPS!**

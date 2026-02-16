#!/bin/bash
# Becastly Fix and Deploy Script
# Run this on your server to fix all issues

set -e

echo "========================================="
echo "🚀 Becastly Fix & Deploy Script"
echo "========================================="

cd /root/becastly

echo ""
echo "📋 Step 1: Fixing Docker Compose (removing localhost binding)..."
sed -i 's/127.0.0.1:3001:3001/3001:3001/g' docker-compose.yml
sed -i 's/127.0.0.1:3000:3000/3000:3000/g' docker-compose.yml
echo "✅ Docker compose fixed"

echo ""
echo "📋 Step 2: Fixing Frontend Dockerfile..."
cat > frontend/Dockerfile << 'DOCKERFILE_EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
DOCKERFILE_EOF
echo "✅ Frontend Dockerfile fixed"

echo ""
echo "📋 Step 3: Fixing Nginx Configuration..."
cat > nginx/nginx.conf << 'NGINX_EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    server {
        listen 80;
        listen [::]:80;
        server_name _;

        # API routes - proxy to backend
        location /api/ {
            proxy_pass http://api:3001/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Auth API routes - proxy to backend
        location /auth/ {
            proxy_pass http://api:3001/auth/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://api:3001/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        # Webhooks
        location /webhooks/ {
            proxy_pass http://api:3001/webhooks/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Everything else goes to frontend (Next.js)
        location / {
            proxy_pass http://frontend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
NGINX_EOF
echo "✅ Nginx configuration fixed"

echo ""
echo "📋 Step 4: Stopping old containers..."
docker-compose down --remove-orphans 2>/dev/null || true
docker system prune -f 2>/dev/null || true
echo "✅ Old containers stopped"

echo ""
echo "📋 Step 5: Building and starting services..."
docker-compose up -d --build
echo "✅ Services started"

echo ""
echo "📋 Step 6: Waiting for services to be ready..."
sleep 15

echo ""
echo "📋 Step 7: Checking service status..."
docker-compose ps

echo ""
echo "📋 Step 8: Testing endpoints..."
echo "Testing API health..."
wget -qO- http://localhost:3001/health 2>/dev/null && echo " ✅ API is working" || echo " ❌ API failed"

echo "Testing Frontend..."
wget -qO- http://localhost:3000/auth/login 2>/dev/null | grep -q "Becastly" && echo " ✅ Frontend is working" || echo " ❌ Frontend failed"

echo "Testing Nginx..."
wget -qO- http://localhost/auth/login 2>/dev/null | grep -q "Becastly" && echo " ✅ Nginx is working" || echo " ❌ Nginx failed"

echo ""
echo "========================================="
echo "🎉 Deployment Complete!"
echo "========================================="
echo ""
echo "🌐 Access your app at:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo "   http://$(hostname -I | awk '{print $1}')/auth/login"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🔧 Useful commands:"
echo "   docker-compose ps     - Check status"
echo "   docker-compose stop   - Stop services"
echo "   docker-compose start  - Start services"
echo ""

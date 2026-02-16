#!/bin/bash

# Becastly Backup Script
# Run this to backup database and uploads

set -e

# Configuration
BACKUP_DIR="${HOME}/backups/becastly"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

echo "🔄 Starting backup..."

# Database backup
echo "📦 Backing up database..."
docker-compose exec -T postgres pg_dump -U becastly becastly | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Redis backup (optional)
echo "📦 Backing up Redis..."
docker-compose exec redis redis-cli BGSAVE
sleep 2
docker cp becastly-redis:/data/dump.rdb "$BACKUP_DIR/redis_backup_$DATE.rdb" 2>/dev/null || echo "⚠️  Redis backup skipped"

# Environment backup
echo "📦 Backing up environment..."
cp .env "$BACKUP_DIR/env_backup_$DATE"

# Cleanup old backups
echo "🧹 Cleaning up old backups..."
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "redis_backup_*.rdb" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "env_backup_*" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup completed!"
echo "📁 Backup location: $BACKUP_DIR"
echo "📄 Files:"
ls -lh $BACKUP_DIR | tail -5

# Optional: Upload to S3 (uncomment if using AWS S3)
# aws s3 sync $BACKUP_DIR s3://your-bucket/becastly-backups/
# echo "☁️  Backup uploaded to S3"

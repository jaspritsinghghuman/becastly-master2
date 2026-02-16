#!/bin/bash

# Becastly VPS Setup Verification Script
# Run this after deployment to verify everything is working

echo "🔍 Becastly VPS Setup Verification"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check_service() {
    local name=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ $name${NC}"
        ((CHECKS_FAILED++))
    fi
}

echo "🐳 Docker Services:"
echo "-------------------"
check_service "PostgreSQL" "docker-compose exec -T postgres pg_isready -U becastly"
check_service "Redis" "docker-compose exec -T redis redis-cli ping"
check_service "API" "curl -s http://localhost:3001/health"
check_service "Nginx" "docker-compose ps nginx | grep Up"

echo ""
echo "🌐 Network Connectivity:"
echo "------------------------"
check_service "HTTP (80)" "nc -z localhost 80"
check_service "HTTPS (443)" "nc -z localhost 443"
check_service "API Port (3001)" "nc -z localhost 3001"

echo ""
echo "💾 Disk Space:"
echo "--------------"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✅ Disk usage: ${DISK_USAGE}%${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Disk usage high: ${DISK_USAGE}%${NC}"
    ((CHECKS_FAILED++))
fi

echo ""
echo "🧠 Memory:"
echo "----------"
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ "$MEMORY_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✅ Memory usage: ${MEMORY_USAGE}%${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Memory usage high: ${MEMORY_USAGE}%${NC}"
    ((CHECKS_FAILED++))
fi

echo ""
echo "==================================="
echo "📊 Summary: $CHECKS_PASSED passed, $CHECKS_FAILED failed"
echo "==================================="

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Your Becastly VPS is ready!${NC}"
    echo ""
    echo "🌐 Access your app:"
    DOMAIN=$(grep DOMAIN .env | cut -d= -f2)
    if [ -n "$DOMAIN" ]; then
        echo "   https://$DOMAIN"
    fi
    exit 0
else
    echo -e "${YELLOW}⚠️  Some checks failed. Check the logs:${NC}"
    echo "   docker-compose logs -f"
    exit 1
fi

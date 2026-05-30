#!/bin/bash
# ==============================================================================
# SkillSphere — EC2 Memory Optimizer & Auto-Recovery Script
# ==============================================================================
# This script configures a 2GB virtual memory swap space to prevent the Free Tier
# t2.micro instance from freezing, then safely boots the Docker Compose stack.
# ==============================================================================

set -e

# Curated harmonious logging styling
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BOLD="\033[1m"
NC="\033[0m"

echo -e "${BLUE}${BOLD}====================================================================${NC}"
echo -e "${BLUE}${BOLD}         SkillSphere — EC2 Memory Optimizer & System Health         ${NC}"
echo -e "${BLUE}${BOLD}====================================================================${NC}"

# ------------------------------------------------------------------------------
# 1. SWAP SPACE ALLOCATION
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/3] Checking swap space memory...${NC}"
if [ -f /swapfile ]; then
    echo -e "${GREEN}✓ Swap file (/swapfile) already exists.${NC}"
else
    echo -e "${BLUE}→ Creating a 2GB swap file (emergency virtual memory)...${NC}"
    # Allocate a 2GB file
    sudo fallocate -l 2G /swapfile
    
    # Restrict permissions
    sudo chmod 600 /swapfile
    
    # Set up swap area
    sudo mkswap /swapfile
    
    # Activate swap
    sudo swapon /swapfile
    
    # Make swap permanent across reboots
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    echo -e "${GREEN}✓ 2GB swap memory successfully created and activated!${NC}"
fi

# Show memory summary
echo -e "\n${BOLD}Current memory allocation status:${NC}"
free -h

# ------------------------------------------------------------------------------
# 2. DOCKER COMPOSE STACK BOOTSTRAPPING
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/3] Checking Docker Compose stack status...${NC}"
DEPLOY_DIR="/opt/skillsphere"

if [ -d "$DEPLOY_DIR" ]; then
    cd "$DEPLOY_DIR"
    echo -e "${BLUE}→ Navigated to deployment directory: $DEPLOY_DIR${NC}"
    
    echo -e "${BLUE}→ Performing a safe, clean container reboot...${NC}"
    # Stop existing containers to flush hung network states & free resources
    docker compose down --remove-orphans 2>/dev/null || true
    
    # Bring up the stack with env file
    if [ -f .env ]; then
        echo -e "${GREEN}✓ Local .env secrets file found. Booting stack...${NC}"
        docker compose --env-file .env up -d --remove-orphans
    else
        echo -e "${YELLOW}⚠ Warning: No .env secrets file found in $DEPLOY_DIR. Starting without env overrides...${NC}"
        docker compose up -d --remove-orphans
    fi
    echo -e "${GREEN}✓ All services initiated!${NC}"
else
    echo -e "${RED}✗ Error: Deployment directory $DEPLOY_DIR does not exist on this server.${NC}"
    exit 1
fi

# ------------------------------------------------------------------------------
# 3. VERIFICATION & HEALTH CHECKS
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/3] Running final verification checks...${NC}"

# Wait a brief moment for database & application container startup
sleep 3

echo -e "\n${GREEN}${BOLD}🎉 System is fully optimized & running fine!${NC}"
echo -e "===================================================================="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo -e "===================================================================="
echo -e "🌐 Main App URL:  ${BOLD}http://localhost${NC} (or your EC2 Public IP)"
echo -e "🩺 Health Check: ${BOLD}http://localhost/api/health${NC}"
echo -e "====================================================================\n"

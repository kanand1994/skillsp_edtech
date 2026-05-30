#!/bin/bash
set -e
ECR=151498474239.dkr.ecr.ap-south-2.amazonaws.com
REGION=ap-south-2

echo "=== Logging into ECR ==="
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR

echo "=== Pulling latest images ==="
docker pull $ECR/skillsphere-backend:latest
docker pull $ECR/skillsphere-frontend:latest

echo "=== Starting containers ==="
cd /opt/skillsphere
BACKEND_IMAGE=$ECR/skillsphere-backend:latest \
FRONTEND_IMAGE=$ECR/skillsphere-frontend:latest \
docker compose up -d --remove-orphans

echo "=== Pruning old images ==="
docker image prune -af

echo ""
echo "=== Deploy complete! Running containers: ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

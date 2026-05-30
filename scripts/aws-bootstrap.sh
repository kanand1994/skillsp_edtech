#!/usr/bin/env bash
# AWS EC2 bootstrap script — run once on a fresh Ubuntu 22.04 EC2 instance.
# Installs Docker, Compose plugin, and clones the repo to /opt/skillsphere.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/your-org/skillsphere.git}"
APP_DIR="/opt/skillsphere"

echo "[1/5] System update"
sudo apt-get update -y && sudo apt-get upgrade -y

echo "[2/5] Install Docker"
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

echo "[3/5] Install AWS CLI v2"
curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscli.zip
sudo apt-get install -y unzip
unzip -q awscli.zip && sudo ./aws/install --update && rm -rf awscli aws awscli.zip

echo "[4/5] Clone repo"
sudo mkdir -p "$APP_DIR" && sudo chown "$USER":"$USER" "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR" || (cd "$APP_DIR" && git pull)

echo "[5/5] Setup .env"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "EDIT $APP_DIR/.env with your secrets, then run: cd $APP_DIR && docker compose up -d"
fi

echo "Done. Open security group ports 80 and 443. Optionally install certbot for SSL."

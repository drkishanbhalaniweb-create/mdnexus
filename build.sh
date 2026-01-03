#!/bin/bash
set -e

echo "Installing system dependencies for Puppeteer..."

# Update package lists
apt-get update || true

# Install Chromium and all required libraries
apt-get install -y --no-install-recommends \
  chromium-browser \
  libnss3 \
  libnspr4 \
  libdbus-1-3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libglib2.0-0 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcb-dri3-0 \
  libxcursor1 \
  libxi6 \
  libxinerama1 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  fonts-liberation \
  libappindicator1 \
  xdg-utils \
  wget \
  ca-certificates || true

echo "Building frontend..."
cd frontend

# Set Puppeteer to use system Chromium
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

npm install
npm run build

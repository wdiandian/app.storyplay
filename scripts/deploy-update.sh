#!/usr/bin/env bash
set -euo pipefail

cd /var/www/storyplay/app

git fetch --all --prune
git reset --hard origin/master
npm ci
npm run build
pm2 restart storyplay
pm2 save

echo "Deploy complete."

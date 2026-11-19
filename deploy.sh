#!/usr/bin/env bash
# Just Rent a Friend deploy script
# Pulls latest code from GitHub, optional code + DB backup, rebuilds and restarts.
# Usage: sudo bash /var/www/justrentafriend/deploy.sh

set -euo pipefail

# ======================= CONFIG — edit if needed =======================
APP_DIR="/var/www/justrentafriend"
REPO_URL="https://github.com/webonspark/justrentafriend.com.git"
BRANCH="main"
BACKUP_DIR="/var/backups/justrentafriend"
KEEP_BACKUPS=7                       # how many old backups of each type to keep
APP_OWNER="ubuntu:ubuntu"            # file owner after deploy
PM2_NAME="justrentafriend-api"       # check with: pm2 list
PM2_USER="root"                      # user that runs pm2 (root or ubuntu)
# =======================================================================

SERVER_DIR="$APP_DIR/server"
CLIENT_DIR="$APP_DIR/client"
TS="$(date +%Y%m%d-%H%M%S)"

green(){ echo -e "\e[32m$*\e[0m"; }
yellow(){ echo -e "\e[33m$*\e[0m"; }
red(){ echo -e "\e[31m$*\e[0m"; }

ask() {   # ask "question" -> returns 0 for yes, 1 for no
  local ans
  while true; do
    read -rp "$1 (y/n): " ans
    case "${ans,,}" in
      y|yes) return 0 ;;
      n|no)  return 1 ;;
      *) echo "Please type y or n." ;;
    esac
  done
}

get_env() {   # read KEY from server/.env (strips quotes)
  grep -E "^$1=" "$SERVER_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

run_pm2() {
  if [ "$PM2_USER" = "root" ]; then pm2 "$@"; else sudo -u "$PM2_USER" -H pm2 "$@"; fi
}

[ "$(id -u)" -eq 0 ] || { red "Run as root: sudo bash $0"; exit 1; }
[ -f "$SERVER_DIR/.env" ] || { red "Missing $SERVER_DIR/.env — create it before deploying."; exit 1; }
cd "$APP_DIR"

echo "========================================"
echo "   Just Rent a Friend deploy — $(date)"
echo "========================================"

ask "Deploy the latest code from GitHub ($BRANCH)?" || { yellow "Cancelled."; exit 0; }

DO_CODE_BACKUP=false; DO_DB_BACKUP=false
ask "Take a CODE backup first?"     && DO_CODE_BACKUP=true
ask "Take a DATABASE backup first?" && DO_DB_BACKUP=true

mkdir -p "$BACKUP_DIR/code" "$BACKUP_DIR/db"

# ---------- 1. Code backup ----------
if $DO_CODE_BACKUP; then
  F="$BACKUP_DIR/code/jraf-code-$TS.tar.gz"
  yellow "→ Backing up code to $F (includes .env and uploads, skips node_modules/dist)"
  tar --exclude='node_modules' --exclude='client/dist' --exclude='client/dist.new' \
      -czf "$F" -C "$(dirname "$APP_DIR")" "$(basename "$APP_DIR")"
  green "  Code backup done: $(du -h "$F" | cut -f1)"
  ls -1t "$BACKUP_DIR"/code/*.tar.gz | tail -n +$((KEEP_BACKUPS+1)) | xargs -r rm -f
fi

# ---------- 2. Database backup ----------
if $DO_DB_BACKUP; then
  DB_HOST="$(get_env DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="$(get_env DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
  DB_USER="$(get_env DB_USER)"
  DB_PASS="$(get_env DB_PASSWORD)"
  DB_NAME="$(get_env DB_NAME)"
  if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    red "Could not read DB_USER / DB_NAME from $SERVER_DIR/.env"
    exit 1
  fi
  F="$BACKUP_DIR/db/jraf-db-$DB_NAME-$TS.sql.gz"
  yellow "→ Backing up database '$DB_NAME' to $F"
  MYSQL_PWD="$DB_PASS" mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
      --single-transaction --no-tablespaces --routines --triggers "$DB_NAME" | gzip > "$F"
  green "  DB backup done: $(du -h "$F" | cut -f1)"
  ls -1t "$BACKUP_DIR"/db/*.sql.gz | tail -n +$((KEEP_BACKUPS+1)) | xargs -r rm -f
fi

# ---------- 3. Pull code from GitHub ----------
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

if [ ! -d "$APP_DIR/.git" ]; then
  yellow "→ First run: linking $APP_DIR to GitHub"
  git init -q
  git remote add origin "$REPO_URL"
fi

PREV_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo none)"
yellow "→ Fetching latest code..."
git fetch -q origin "$BRANCH"

if [ "$PREV_COMMIT" != "none" ]; then
  echo "Incoming changes:"
  git log --oneline HEAD..origin/"$BRANCH" || true
fi

# Overwrites tracked code files only. server/.env, server/uploads and
# node_modules stay untouched because they are not in the repo.
git checkout -q -f -B "$BRANCH" "origin/$BRANCH"
git reset -q --hard "origin/$BRANCH"
NEW_COMMIT="$(git rev-parse --short HEAD)"
green "  Code now at commit $NEW_COMMIT (was $PREV_COMMIT)"

# ---------- 4. Server: install deps + create any new tables ----------
yellow "→ Installing server dependencies..."
cd "$SERVER_DIR"
npm ci --omit=dev
green "  Server dependencies installed"

yellow "→ Creating any missing database tables..."
npm run db:migrate
green "  Database schema up to date"

# ---------- 5. Client: install + build (zero-downtime swap) ----------
yellow "→ Building client..."
cd "$CLIENT_DIR"
npm ci
rm -rf dist.new
npm run build -- --outDir dist.new --emptyOutDir
[ -f dist.new/index.html ] || { red "Build failed: dist.new/index.html missing. Live site NOT changed."; exit 1; }
rm -rf dist.old
[ -d dist ] && mv dist dist.old
mv dist.new dist
rm -rf dist.old
green "  Client built and swapped in"

# ---------- 6. Permissions ----------
chown -R "$APP_OWNER" "$APP_DIR"
chmod 600 "$SERVER_DIR/.env"

# ---------- 7. Restart backend ----------
yellow "→ Restarting backend..."
cd "$SERVER_DIR"
if command -v pm2 >/dev/null 2>&1; then
  if run_pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    run_pm2 restart "$PM2_NAME" --update-env
  else
    yellow "  pm2 process '$PM2_NAME' not found — starting it"
    run_pm2 start src/server.js --name "$PM2_NAME"
  fi
  run_pm2 save >/dev/null
else
  red "  pm2 not found — restart your backend manually."
fi

# ---------- 8. Reload nginx ----------
if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx && green "  Nginx reloaded"
fi

echo
green "========================================"
green " Deploy complete: $PREV_COMMIT → $NEW_COMMIT"
green "========================================"
echo "Backups folder: $BACKUP_DIR"
echo "Rollback code:  cd $APP_DIR && git reset --hard $PREV_COMMIT, then rebuild client (npm ci && npm run build) and pm2 restart $PM2_NAME"

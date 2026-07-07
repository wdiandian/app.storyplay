# app.storyplay.cc deployment

This project is deployed with:

- Next.js 16
- Node.js 24
- PM2
- Nginx
- Cloudflare DNS and HTTPS
- Optional shared PostgreSQL via `DATABASE_URL`

## 1. Server bootstrap

Run on the Tencent Cloud server:

```bash
sudo apt update
sudo apt install -y nginx curl git unzip
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

## 2. First deploy

Prepare the target directory:

```bash
sudo mkdir -p /var/www/storyplay-app
sudo chown -R $USER:$USER /var/www/storyplay-app
```

For the first release only, upload or clone the repository.

Recommended approach:

```bash
cd /var/www/storyplay-app
git clone https://github.com/wdiandian/app.storyplay.git app
cd /var/www/storyplay-app/app
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 2.1 Shared remote database

If you want local and server to use the same admin data, configure the same PostgreSQL
connection string in both environments:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
PGSSL=true
```

Create a local `.env.local` and a server `.env.production` or PM2 environment with the
same `DATABASE_URL`.

When `DATABASE_URL` is present:

- the app reads and writes PostgreSQL
- local SQLite becomes fallback only
- local and server admin operate on the same project data

If you already have data in SQLite, import it once:

```bash
cd /var/www/storyplay-app/app
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME npm run db:import:sqlite
```

`pm2 startup` prints one extra command. Run that command once.

Check status:

```bash
pm2 status
pm2 logs storyplay-app
```

## 3. Cloudflare DNS

Create these records in Cloudflare:

- `A` record: `app` -> server public IP

Enable the orange cloud proxy on the record.

## 4. Cloudflare origin certificate

In Cloudflare:

- `SSL/TLS`
- `Origin Server`
- `Create Certificate`

Hostnames:

- `app.storyplay.cc`

Save them on the server:

```bash
sudo mkdir -p /etc/ssl/private /etc/ssl/certs
sudo nano /etc/ssl/certs/storyplay-origin.pem
sudo nano /etc/ssl/private/storyplay-origin.key
sudo chmod 600 /etc/ssl/private/storyplay-origin.key
```

## 5. Nginx

Install the site config:

```bash
sudo cp /var/www/storyplay-app/app/nginx/storyplay.conf /etc/nginx/sites-available/storyplay-app
sudo ln -sf /etc/nginx/sites-available/storyplay-app /etc/nginx/sites-enabled/storyplay-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Cloudflare SSL mode

Set:

- `SSL/TLS` -> `Overview` -> `Full (strict)`
- enable `Always Use HTTPS`

## 7. Ongoing deploys with Git

Local workflow:

```bash
git add .
git commit -m "your change"
git push origin master
```

Server deploy:

```bash
cd /var/www/storyplay-app/app
bash scripts/deploy-update.sh
```

The update script does:

- `git fetch --all --prune`
- `git reset --hard origin/master`
- `npm ci`
- `npm run build`
- `pm2 restart storyplay-app`
- `pm2 save`

## 8. Troubleshooting

```bash
pm2 status
pm2 logs storyplay-app
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 9. Data backup

SQLite file fallback:

```bash
/var/www/storyplay-app/app/data/app.db
```

Backup:

```bash
cp /var/www/storyplay-app/app/data/app.db /var/www/storyplay-app/app/data/app.db.bak
```

PostgreSQL backup should be done from the database provider side or with `pg_dump`.

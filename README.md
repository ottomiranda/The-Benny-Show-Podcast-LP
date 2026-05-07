# The Beny Podcast Show — Landing Page

Marketing site and newsletter signup for **The Beny Podcast Show**. Single static page served by a small Express server that exposes a Mailchimp-backed subscribe endpoint.

## Stack

- **Frontend**: HTML + inline CSS + TypeScript (no UI framework). Built with Vite.
- **Backend**: Express 5 on Node 22+ exposing `POST /api/subscribe`, which calls the Mailchimp Marketing API v3.
- **Hosting supported**:
  - **DigitalOcean Droplet** (primary production — Nginx + PM2 + Node).
  - **Vercel** (full parity — uses `api/subscribe.ts` as a serverless function).
- **YouTube**: client-side hydration of channel stats and the latest episode via the YouTube Data API v3.
- **Mailchimp**: server-side Marketing API v3 with a custom merge field (`MMERGE7` / "Topic suggestion").

## Project structure

```
.
├── api/
│   └── subscribe.ts          ← Vercel function (Mailchimp API v3)
├── server/
│   └── index.ts              ← Express server for DO Droplet (same logic)
├── src/
│   ├── lib/
│   │   ├── youtube.ts        ← YouTube Data API client
│   │   ├── mailchimp.ts      ← Wrapper that POSTs to /api/subscribe
│   │   ├── testimonials.ts   ← Static review data
│   │   ├── brandPitch.ts     ← Brand-pitch form logic
│   │   └── links.ts
│   └── scripts/
│       ├── main.ts           ← Entry point (hydration, listeners)
│       └── brand-pitch.ts
├── public/                   ← Static images (avif/jpg/png/svg)
├── dist/                     ← Output of `npm run build` (gitignored)
├── index.html                ← Single page with inline CSS/HTML
├── package.json
└── .env.example              ← Variables template (do NOT commit the real .env)
```

## Environment variables

Create a `.env` at the project root based on `.env.example`. Variables prefixed with `VITE_` are inlined into the browser bundle (public); the others are **server-only**.

### Public (frontend)

| Var | Description |
|---|---|
| `VITE_YT_API_KEY` | YouTube Data API v3 key (read-only) |
| `VITE_YT_CHANNEL_ID` | YouTube channel ID |
| `VITE_BRAND_PITCH_URL` | Formspree URL for the brand-partnership form |

### Private (server — Vercel or Droplet)

| Var | Description |
|---|---|
| `MAILCHIMP_API_KEY` | Mailchimp API key (format: `xxxxxxx-us14`) |
| `MAILCHIMP_LIST_ID` | Audience ID (10 hex chars) |
| `MAILCHIMP_DC` | Data center suffix from the API key (e.g. `us14`) |
| `PORT` | Express port (Droplet only). Default `3000` |
| `HOST` | Express bind address. Default `127.0.0.1` |

> **Never commit `.env`.** It is already in `.gitignore`.

## One-time Mailchimp configuration

The subscribe endpoint sends three fields: `FNAME` (first name), `email_address`, and `MMERGE7` (Topic suggestion).

For `MMERGE7` to be accepted:

1. Open Mailchimp → **Audience → "..." → Audience settings → Audience fields and merge tags**
2. Click **"Create a new field"**
3. Configure: **Field name** = `Topic suggestion`, **Data type** = `Text`, **Required** = unchecked
4. Save. Mailchimp auto-assigns the merge tag `*|MMERGE7|*`
5. **Important:** open `https://us14.admin.mailchimp.com/lists/designer/` (Form Designer) and drag `Topic suggestion` into the form. The Marketing API v3 does not strictly require this, but keeping the form in sync avoids confusion in case the integration ever falls back to the hosted-form endpoint.

> If the field number ends up as something other than `MMERGE7` (e.g., a different field was created earlier), update the constant in **`api/subscribe.ts`** and **`server/index.ts`** (search for `MMERGE7`).

## Local development

### Prerequisites

- Node.js **22 or later** (`node -v`)
- npm 10+

### Setup

```bash
git clone <repo-url> beny-podcast-lp
cd beny-podcast-lp
npm install
cp .env.example .env
# fill .env with real values
```

### Run in dev (frontend only, hot reload)

```bash
npm run dev
```

Vite serves on `http://localhost:5173`. Useful for editing HTML/CSS/JS — does **not** run `/api/subscribe`. To test the subscribe endpoint locally, run the Express server instead:

```bash
npm run build       # produces dist/
npm start           # serves dist/ + /api/subscribe on http://127.0.0.1:3000
```

### Lint

```bash
npm run lint
```

## Production build

```bash
npm run build
```

Output in `dist/`:
- `dist/index.html` (~106 KB with inlined CSS)
- `dist/assets/index-*.js` (bundle of `src/scripts/main.ts`)
- Images copied from `public/`

## Deployment

### Option 1 — DigitalOcean Droplet (primary production)

#### Server prep (one-time)

```bash
# As root or with sudo
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
```

#### Clone and build

```bash
sudo mkdir -p /var/www/beny-podcast
sudo chown $USER:$USER /var/www/beny-podcast
cd /var/www/beny-podcast
git clone git@github.com:USER/REPO.git .
npm ci
npm run build
```

#### Configure `.env`

```bash
cat > /var/www/beny-podcast/.env <<'EOF'
MAILCHIMP_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us14
MAILCHIMP_LIST_ID=xxxxxxxxxx
MAILCHIMP_DC=us14
PORT=3000
HOST=127.0.0.1
VITE_YT_API_KEY=...
VITE_YT_CHANNEL_ID=...
VITE_BRAND_PITCH_URL=...
EOF
chmod 600 .env
```

> `HOST=127.0.0.1` keeps Node bound to loopback only; Nginx is the single external entry point.

#### Start with PM2

```bash
cd /var/www/beny-podcast
pm2 start npm --name "beny-podcast" -- start
pm2 save
pm2 startup systemd
# paste/run the command it prints → makes it survive reboots
```

Useful commands:
- `pm2 logs beny-podcast` — tail logs
- `pm2 restart beny-podcast` — restart with brief downtime
- `pm2 reload beny-podcast` — zero-downtime reload
- `pm2 status` — overall status

#### Nginx config

Create `/etc/nginx/sites-available/beny-podcast`:

```nginx
server {
    listen 80;
    server_name thebenypodcastshow.com www.thebenypodcastshow.com;
    root /var/www/beny-podcast/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /healthz {
        proxy_pass http://127.0.0.1:3000;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/beny-podcast /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

#### SSL (Certbot)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d thebenypodcastshow.com -d www.thebenypodcastshow.com
```

Auto-renewal is set up via a systemd timer.

#### Release workflow

```bash
cd /var/www/beny-podcast
git pull
npm ci             # only if package.json changed
npm run build
pm2 reload beny-podcast
```

### Option 2 — Vercel

The project is already linked (`.vercel/project.json`).

Deploy:

```bash
npx vercel deploy --prod --yes
```

Environment variables:

```bash
npx vercel env add MAILCHIMP_API_KEY production
npx vercel env add MAILCHIMP_LIST_ID production
npx vercel env add MAILCHIMP_DC production
```

Vercel automatically picks up `api/subscribe.ts` as a serverless function (same logic as the Express server, only the adapter differs).

## Endpoints

### `POST /api/subscribe`

Accepts JSON, returns JSON.

**Request:**
```json
{
  "name": "Carlos",
  "email": "carlos@example.com",
  "topic": "How to start investing in 2026"
}
```

**Responses:**
- `200 { "ok": true, "message": "Welcome, Carlos! Check your inbox." }` — subscribed
- `200 { "ok": true, "message": "You are already subscribed." }` — already in the list
- `400 { "ok": false, "message": "..." }` — invalid input (short name, bad email)
- `500 { "ok": false, "message": "Newsletter is not configured." }` — missing env vars
- `502 { "ok": false, "message": "Network error. Please try again." }` — network failure

### `GET /healthz`

Health check for liveness/readiness probes.
```json
{ "ok": true }
```

## Troubleshooting

### `Newsletter is not configured.`
One of the three env vars is missing (`MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_DC`). Check `.env` on the Droplet or environment variables on Vercel.

### Topic suggestion arriving empty in Mailchimp
- Verify the merge field exists in the audience with tag `MMERGE7` (or update `api/subscribe.ts` and `server/index.ts` if the tag is different)
- Confirm the field is added to the Form Builder

### Express won't start (PM2 shows error)
- `pm2 logs beny-podcast --err --lines 100` shows the stack trace
- Confirm `dist/` exists (run `npm run build` before `pm2 start`)
- Confirm `.env` is in the directory where pm2 ran the start command

### Nginx 502 Bad Gateway
- Node isn't running: `pm2 status`
- Wrong port: check `PORT` in `.env` against `proxy_pass` in Nginx
- Wrong bind: keep `HOST=127.0.0.1` (do not use `0.0.0.0` if Nginx is the gateway)

### YouTube stats don't update
- Check `VITE_YT_API_KEY` in `.env` and rebuild
- DevTools → Console → look for `[hydrate]` warnings
- Verify API quota in the Google Cloud Console

## Maintenance notes

- `index.html` ships with inline CSS (~3000+ lines). Large visual changes can be painful to review — consider extracting CSS into separate files if the project grows.
- `package.json` still carries unused React dependencies (leftover from initial scaffolding). They can be removed carefully.
- If the Mailchimp merge field tag changes, update **both** occurrences of `MMERGE7` in `api/subscribe.ts` and `server/index.ts`.
- `VITE_*` variables are **inlined into the public bundle**. Never put secrets there.

## License

Private. All rights reserved by The Beny Podcast Show.

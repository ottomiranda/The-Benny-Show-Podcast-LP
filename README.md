# The Beny Podcast Show — Landing Page

Site institucional e de captação de inscrições para o podcast **The Beny Podcast Show**. Página única, estática, servida com um pequeno servidor Express que expõe o endpoint de inscrição na newsletter integrado ao Mailchimp.

## Stack

- **Frontend**: HTML + CSS inline + TypeScript (sem framework de UI). Build via Vite.
- **Backend**: Express 5 (Node 22+) com endpoint `/api/subscribe` que chama a Mailchimp Marketing API v3.
- **Hospedagem suportada**:
  - **DigitalOcean Droplet** (produção principal — Nginx + PM2 + Node).
  - **Vercel** (paridade total — usa `api/subscribe.ts` como serverless function).
- **YouTube**: hidratação client-side de stats e último episódio via YouTube Data API v3.
- **Mailchimp**: Marketing API v3 (server-side) com merge field customizado.

## Estrutura

```
.
├── api/
│   └── subscribe.ts          ← Vercel function (Mailchimp API v3)
├── server/
│   └── index.ts              ← Express server p/ DO Droplet (mesma lógica)
├── src/
│   ├── lib/
│   │   ├── youtube.ts        ← YouTube Data API client
│   │   ├── mailchimp.ts      ← Wrapper que faz POST p/ /api/subscribe
│   │   ├── testimonials.ts   ← Dados estáticos de reviews
│   │   ├── brandPitch.ts     ← Lógica do form de brand-pitch
│   │   ├── mailchimp.ts      ← Cliente do endpoint de inscrição
│   │   └── links.ts
│   └── scripts/
│       ├── main.ts           ← Entry point (hidratação, listeners)
│       └── brand-pitch.ts
├── public/                   ← Imagens estáticas (avif/jpg/png/svg)
├── dist/                     ← Output do `npm run build` (gitignored)
├── index.html                ← Single-page com CSS/HTML inline
├── package.json
└── .env.example              ← Template de variáveis (NÃO commitar .env real)
```

## Variáveis de ambiente

Crie um `.env` na raiz baseado em `.env.example`. Variáveis com prefixo `VITE_` são embutidas no bundle do navegador (públicas); as demais são **servidor-only**.

### Públicas (frontend)

| Var | Descrição |
|---|---|
| `VITE_YT_API_KEY` | Chave da YouTube Data API v3 (somente-leitura) |
| `VITE_YT_CHANNEL_ID` | ID do canal do YouTube |
| `VITE_BRAND_PITCH_URL` | URL do Formspree para envio do form de parcerias |

### Privadas (servidor — Vercel ou Droplet)

| Var | Descrição |
|---|---|
| `MAILCHIMP_API_KEY` | API key do Mailchimp (formato `xxxxxxx-us14`) |
| `MAILCHIMP_LIST_ID` | Audience ID (10 chars hex) |
| `MAILCHIMP_DC` | Data center, sufixo da API key (ex: `us14`) |
| `PORT` | Porta do Express (Droplet). Default `3000` |
| `HOST` | Bind address do Express. Default `127.0.0.1` |

> **Nunca commite o `.env`.** Já está no `.gitignore`.

## Configuração no Mailchimp (uma vez)

A inscrição envia 3 campos: `FNAME` (First Name), `email_address`, e `MMERGE7` (Topic suggestion).

Para o merge field `MMERGE7` funcionar:

1. Mailchimp → **Audience → "..." → Audience settings → Audience fields and merge tags**
2. Clique em **"Create a new field"**
3. Configure: **Field name**: `Topic suggestion`, **Data type**: `Text`, **Required**: desmarcado
4. Salve. Mailchimp atribui automaticamente o tag `*|MMERGE7|*`
5. **Importante:** vá em `https://us14.admin.mailchimp.com/lists/designer/` (Form Designer) e arraste o campo `Topic suggestion` pra dentro do formulário. Sem isso, o JSONP-ish do Mailchimp ignora o valor (a API v3 funciona, mas é boa prática manter consistente).

> Se a numeração `MMERGE7` mudar (porque foi criado outro campo antes), atualize a referência em **`api/subscribe.ts`** e **`server/index.ts`** (procure por `MMERGE7`).

## Desenvolvimento local

### Pré-requisitos

- Node.js **22 ou superior** (`node -v`)
- npm 10+

### Setup

```bash
git clone <repo-url> beny-podcast-lp
cd beny-podcast-lp
npm install
cp .env.example .env
# preencha .env com seus valores reais
```

### Rodar em dev (só frontend, hot reload)

```bash
npm run dev
```

Vite sobe em `http://localhost:5173`. Útil pra editar HTML/CSS/JS — não roda o endpoint `/api/subscribe`. Se precisar testar a inscrição local, rode o servidor Express:

```bash
npm run build       # gera dist/
npm start           # sobe Express em http://127.0.0.1:3000 servindo dist/ + /api/subscribe
```

### Lint

```bash
npm run lint
```

## Build de produção

```bash
npm run build
```

Output em `dist/`:
- `dist/index.html` (~106 KB com CSS inline)
- `dist/assets/index-*.js` (bundle do `src/scripts/main.ts`)
- Imagens copiadas de `public/`

## Deploy

### Opção 1 — DigitalOcean Droplet (produção principal)

#### Preparar servidor (uma vez)

```bash
# Como root ou com sudo
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
```

#### Clonar e buildar

```bash
sudo mkdir -p /var/www/beny-podcast
sudo chown $USER:$USER /var/www/beny-podcast
cd /var/www/beny-podcast
git clone git@github.com:USER/REPO.git .
npm ci
npm run build
```

#### Configurar `.env`

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

> `HOST=127.0.0.1` faz o Node escutar só em loopback; Nginx é o único ponto de entrada externo.

#### Subir com PM2

```bash
cd /var/www/beny-podcast
pm2 start npm --name "beny-podcast" -- start
pm2 save
pm2 startup systemd
# cole/execute o comando que ele imprimir → faz sobreviver a reboots
```

Comandos úteis:
- `pm2 logs beny-podcast` — logs em tempo real
- `pm2 restart beny-podcast` — restart com downtime curto
- `pm2 reload beny-podcast` — zero-downtime reload
- `pm2 status` — status geral

#### Configurar Nginx

Crie `/etc/nginx/sites-available/beny-podcast`:

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

Ativar:

```bash
sudo ln -s /etc/nginx/sites-available/beny-podcast /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

#### SSL (Certbot)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d thebenypodcastshow.com -d www.thebenypodcastshow.com
```

Renovação é automática via timer do systemd.

#### Workflow de release

```bash
cd /var/www/beny-podcast
git pull
npm ci             # só se package.json mudou
npm run build
pm2 reload beny-podcast
```

### Opção 2 — Vercel

Projeto já linkado (`.vercel/project.json`).

Deploy:

```bash
npx vercel deploy --prod --yes
```

Variáveis de ambiente:

```bash
npx vercel env add MAILCHIMP_API_KEY production
npx vercel env add MAILCHIMP_LIST_ID production
npx vercel env add MAILCHIMP_DC production
```

A Vercel usa `api/subscribe.ts` automaticamente como serverless function (mesma lógica do Express, só com adapter diferente).

## Endpoints

### `POST /api/subscribe`

Aceita JSON e retorna JSON.

**Request:**
```json
{
  "name": "Carlos",
  "email": "carlos@example.com",
  "topic": "Como começar a investir em 2026"
}
```

**Responses:**
- `200 { "ok": true, "message": "Welcome, Carlos! Check your inbox." }` — inscrito
- `200 { "ok": true, "message": "You are already subscribed." }` — já existia
- `400 { "ok": false, "message": "..." }` — input inválido (nome curto, email inválido)
- `500 { "ok": false, "message": "Newsletter is not configured." }` — env vars faltando
- `502 { "ok": false, "message": "Network error. Please try again." }` — falha de rede

### `GET /healthz`

Health check pra liveness/readiness probes.
```json
{ "ok": true }
```

## Troubleshooting

### `Newsletter is not configured.`
Falta uma das três env vars (`MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_DC`). Confira `.env` no Droplet ou env vars na Vercel.

### Topic suggestion chegando vazio no Mailchimp
- Verifique que o merge field existe na audience com tag `MMERGE7` (ou ajuste `api/subscribe.ts` e `server/index.ts` se a tag for outra)
- Confirme que o campo está adicionado ao Form Builder

### Express não inicia (PM2 mostra erro)
- `pm2 logs beny-podcast --err --lines 100` mostra stack trace
- Confira se `dist/` existe (rodar `npm run build` antes do `pm2 start`)
- Confira se `.env` está no diretório onde o pm2 rodou o start

### Nginx 502 Bad Gateway
- Node não está rodando: `pm2 status`
- Porta errada: confira `PORT` no `.env` vs `proxy_pass` no Nginx
- Bind errado: `HOST=127.0.0.1` no `.env` (não use `0.0.0.0` se Nginx é o gateway)

### YouTube stats não atualizam
- Confira `VITE_YT_API_KEY` no `.env` e rebuilde
- DevTools → Console → procure por warnings de `[hydrate]`
- Verifique cota da API no Google Cloud Console

## Pontos de atenção pra futuras manutenções

- O `index.html` tem CSS embutido (~3000+ linhas). Mudanças visuais grandes podem ser dolorosas de revisar — considere extrair para arquivos separados se o projeto crescer.
- O `package.json` ainda tem dependências React não usadas (resíduo do scaffold inicial). Podem ser removidas com cuidado.
- Mudou o nome do merge field no Mailchimp? Atualize **as duas** ocorrências de `MMERGE7` em `api/subscribe.ts` e `server/index.ts`.
- Variáveis `VITE_*` ficam **embutidas no bundle público**. Nunca coloque secrets ali.

## Licença

Privado. Todos os direitos reservados a The Beny Podcast Show.

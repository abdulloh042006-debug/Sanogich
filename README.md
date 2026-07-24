# Sanogich — count what matters

Sanogich (Uzbek: *sanog'ich*, "counter") is a fast, focused **counter & habit-tracking
web application**. Create counters for anything — glasses of water, pages read,
workouts done — tap to count, set daily targets, and build streaks.

**Stack:** Python 3.11+ · Flask · SQLAlchemy · Flask-Login · vanilla HTML/CSS/JS · Gunicorn

## Features

- 🔐 Account registration and session-based sign-in (hashed passwords, CSRF-protected)
- ➕ Unlimited-feel counters with custom name, color, step size, and optional daily target
- ⚡ One-tap increment / decrement / reset with an append-only event history
- 🎯 Live progress bars toward targets, with "target reached" feedback
- 🔥 Current & best streaks, today's total, and a 14-day activity chart
- 📱 Responsive UI that works on desktop and mobile
- 🗄️ SQLite out of the box; PostgreSQL-ready via `DATABASE_URL`

## Project structure

```
sanogich/
├── app/
│   ├── __init__.py          # App factory: config, logging, blueprints, errors
│   ├── config.py            # Env-driven configuration (dev / prod / test)
│   ├── extensions.py        # SQLAlchemy + Flask-Login instances
│   ├── models.py            # User, Counter, CounterEvent
│   ├── security.py          # CSRF protection + security headers
│   ├── validators.py        # Input validation helpers
│   ├── routes/
│   │   ├── main.py          # Landing page, dashboard shell, health check
│   │   ├── auth.py          # Register / login / logout
│   │   └── api.py           # JSON API for counters, history, stats
│   ├── services/
│   │   └── stats.py         # Daily totals, streak calculation
│   ├── templates/           # Jinja2 templates (base, landing, auth, dashboard, errors)
│   └── static/              # css/main.css, js/api.js, js/dashboard.js, img/logo.svg
├── tests/                   # Pytest suite (auth, counters API, streak logic)
├── wsgi.py                  # Entry point (python wsgi.py / gunicorn wsgi:app)
├── gunicorn.conf.py         # Production server config
├── requirements.txt
├── Dockerfile / .dockerignore
└── .env.example
```

## Run locally

```bash
# 1. Clone and enter the project
git clone <repo-url> sanogich && cd sanogich

# 2. Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env               # defaults are fine for development

# 5. Run (tables are created automatically on first start)
python wsgi.py
```

Open <http://127.0.0.1:5000>, create an account, and start counting.

Run the tests:

```bash
python -m pytest -q
```

## Deploy to production

### Option A — Docker (recommended)

```bash
docker build -t sanogich .
docker run -d --name sanogich \
  -p 8000:8000 \
  -e SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')" \
  -e FLASK_ENV=production \
  -v sanogich-data:/srv/sanogich/instance \
  sanogich
```

Put a TLS-terminating reverse proxy (nginx, Caddy, or your platform's load
balancer) in front of port 8000. `SESSION_COOKIE_SECURE` is enabled in
production, so HTTPS is required for sign-in to work.

For PostgreSQL, add `-e DATABASE_URL=postgresql+psycopg://user:pass@host:5432/sanogich`
and install the driver (`pip install psycopg[binary]`).

### Option B — bare VM with systemd

```bash
sudo mkdir -p /srv/sanogich && cd /srv/sanogich
# copy the project here, then:
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# /etc/systemd/system/sanogich.service
# ------------------------------------
# [Unit]
# Description=Sanogich
# After=network.target
# [Service]
# WorkingDirectory=/srv/sanogich
# Environment=FLASK_ENV=production
# Environment=SECRET_KEY=<your-generated-secret>
# ExecStart=/srv/sanogich/.venv/bin/gunicorn --config gunicorn.conf.py wsgi:app
# Restart=always
# [Install]
# WantedBy=multi-user.target

sudo systemctl enable --now sanogich
```

The app refuses to boot in production with the default `SECRET_KEY` — generate
one with `python -c "import secrets; print(secrets.token_hex(32))"`.

A `/healthz` endpoint is provided for load-balancer health checks.

## Configuration reference

| Variable       | Default                      | Purpose                               |
| -------------- | ---------------------------- | ------------------------------------- |
| `FLASK_ENV`    | `development`                | `development` / `production` / `testing` |
| `SECRET_KEY`   | dev-only placeholder         | Session signing key (**required** in prod) |
| `DATABASE_URL` | SQLite in `instance/`        | Any SQLAlchemy connection string      |
| `LOG_DIR`      | `logs`                       | Rotating file logs in production      |
| `HOST` / `PORT`| `127.0.0.1` / `5000`         | Local dev server bind                 |

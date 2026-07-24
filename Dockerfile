FROM python:3.12-slim

# Never run as root inside the container.
RUN groupadd -r sanogich && useradd -r -g sanogich sanogich

WORKDIR /srv/sanogich

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY wsgi.py gunicorn.conf.py ./

# Instance dir holds the SQLite DB when no external DATABASE_URL is set;
# mount a volume here to persist it.
RUN mkdir -p instance logs && chown -R sanogich:sanogich /srv/sanogich

USER sanogich

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz')" || exit 1

CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]

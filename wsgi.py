"""WSGI entry point: `gunicorn wsgi:app` in production, `python wsgi.py` locally."""

import os

from dotenv import load_dotenv

load_dotenv()

from app import create_app  # noqa: E402  (import after .env is loaded)

app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
    )

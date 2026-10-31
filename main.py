"""Vercel entrypoint for the SanjeevaniGrid FastAPI app and Vite frontend."""

from backend.app.main import app

# Vercel builds this directory before startup and serves its assets from the CDN.
# The index fallback supports direct navigation to frontend routes.
app.frontend("/", directory="dist", fallback="index.html")

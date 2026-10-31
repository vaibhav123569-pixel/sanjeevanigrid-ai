"""Vercel entrypoint for the SanjeevaniGrid FastAPI app and Vite frontend."""

from backend.app.main import app

# Vercel promotes the Vite build to its CDN; API routes remain on FastAPI.
app.frontend("/", directory="dist")

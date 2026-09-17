# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- builder
FROM python:3.12-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---------------------------------------------------------------- runtime
FROM python:3.12-slim

RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -M appuser

WORKDIR /app

COPY --from=builder /install /usr/local

# FIX: Create the 'backend' namespace directory so absolute imports 
# like 'from backend.app.config import settings' resolve correctly.
RUN mkdir -p /app/backend

# Copy the 'app' folder INTO the 'backend' namespace
COPY --chown=appuser:appgroup app/ ./backend/app/

# Optional: If you ever want to run migrations from this image in the future, 
# uncomment these lines to include Alembic:
# COPY --chown=appuser:appgroup alembic/ ./backend/alembic/
# COPY --chown=appuser:appgroup alembic.ini ./backend/

USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

# FIX: Updated uvicorn target to match the new backend.app.main path
CMD ["uvicorn", "backend.app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
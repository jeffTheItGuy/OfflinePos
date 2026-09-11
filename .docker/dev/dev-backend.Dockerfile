FROM python:3.12-slim

WORKDIR /app

# Install deps first so this layer caches across source-only edits.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source is NOT copied — compose bind-mounts ./backend over /app at run time.
# The image only supplies the Python runtime and site-packages.

EXPOSE 8000

# --reload watches /app for .py changes and restarts the process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
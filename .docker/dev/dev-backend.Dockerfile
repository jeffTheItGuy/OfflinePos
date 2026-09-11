FROM python:3.12-slim

WORKDIR /workspace/backend

# Install deps first so this layer caches across source-only edits.
# Note: Context is now the project root, so we copy from backend/
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

# --reload watches the working directory (/workspace/backend) for .py changes
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
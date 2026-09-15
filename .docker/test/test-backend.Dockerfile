FROM python:3.12-slim

WORKDIR /backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir pytest httpx alembic

COPY . .

# We force the PYTHONPATH export directly in the shell command 
# so Docker's layer caching cannot possibly strip it out.
CMD ["sh", "-c", "export PYTHONPATH=/ && alembic upgrade head && python -m pytest tests/ -m integration -v --tb=short"]
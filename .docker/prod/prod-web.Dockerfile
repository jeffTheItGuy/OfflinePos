# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine AS runtime

# Security: Run as non-root nginx user
USER nginx

# Fix: Copy from /web/dist (not /app/dist) and assign ownership to nginx
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx:nginx /web/dist /usr/share/nginx/html

# Shifted to 8080 to allow non-root binding
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
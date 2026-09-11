FROM node:20-alpine

WORKDIR /app

# Seed node_modules. At run time a named volume holds this directory so
# the ./web bind mount doesn't shadow it.
COPY package.json package-lock.json* ./
RUN npm install

EXPOSE 5173

# --host 0.0.0.0 is what makes the Vite dev server reachable from your host.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
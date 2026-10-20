FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps ./apps
COPY --chown=node:node --from=build /app/scripts ./scripts
RUN mkdir -p /app/uploads /app/data && chown node:node /app/uploads /app/data
USER node
ENV PORT=5000
ENV WEB_PORT=3000
ENV API_PROXY_TARGET=http://127.0.0.1:5000
ENV UPLOADS_DIR=/app/uploads
ENV DATA_FILE=/app/data/store.json
EXPOSE 3000
VOLUME ["/app/uploads", "/app/data"]
CMD ["node", "scripts/start.cjs"]

# ---- deps ----
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- build ----
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=deps /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/src/migrations ./src/migrations
# 上传目录：容器里换成 S3 driver 时不需要；用本地卷时挂到 /app/media
RUN mkdir -p media
EXPOSE 3100
CMD ["node", "server.js"]

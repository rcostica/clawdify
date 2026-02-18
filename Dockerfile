# ─── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# better-sqlite3 needs to be rebuilt for the alpine (musl) target
RUN apk add --no-cache python3 make g++ && \
    npm rebuild better-sqlite3 && \
    npm run build

# ─── Stage 3: Production image ───────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 clawdify && \
    adduser --system --uid 1001 clawdify

# Copy built output and production dependencies
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create default DB directory
RUN mkdir -p /home/clawdify/.clawdify && chown -R clawdify:clawdify /home/clawdify

USER clawdify

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

FROM node:26-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:26-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Build revision (commit SHA) reported by /api/v1/health. Declared after the
# dependency layers so a new SHA does not invalidate the npm ci cache.
ARG HAVA81_API_REVISION=unknown
ENV HAVA81_API_REVISION=${HAVA81_API_REVISION}
LABEL org.opencontainers.image.revision=${HAVA81_API_REVISION}

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/src/server.js"]

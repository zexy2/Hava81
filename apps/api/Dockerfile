FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache --virtual .npm-git-deps git && npm ci --no-audit && apk del .npm-git-deps

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache --virtual .npm-git-deps git && npm ci --omit=dev --no-audit && npm cache clean --force && apk del .npm-git-deps
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/src/server.js"]

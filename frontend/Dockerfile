FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# nft trace quirk: the standalone node_modules gets @swc/helpers' package.json
# (or nothing) but not the esm/_interop_require_default.js the next server
# require-hook resolves at boot. Replace the traced copy with the full
# package and fail the build fast if it is ever incomplete again.
RUN set -ex \
    && rm -rf .next/standalone/node_modules/@swc/helpers \
    && mkdir -p .next/standalone/node_modules/@swc/helpers \
    && cp -a node_modules/@swc/helpers/. .next/standalone/node_modules/@swc/helpers/ \
    && test -f .next/standalone/node_modules/@swc/helpers/esm/_interop_require_default.js

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

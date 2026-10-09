FROM node:24-alpine AS deps
WORKDIR /app
COPY apps/web/package*.json ./
RUN --mount=type=secret,id=build_ca --mount=type=cache,target=/root/.npm \
    if [ -f /run/secrets/build_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm ci --no-fund; \
    else npm ci --no-fund; fi
FROM deps AS build
COPY apps/web .
ARG API_URL=http://api:8080
ENV API_URL=$API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

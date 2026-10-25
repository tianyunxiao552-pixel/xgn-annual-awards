FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 XGN_DATA_DIR=/app/data
COPY --from=build /app/dist ./dist
COPY package.json ./package.json
COPY server ./server
COPY shared ./shared
COPY content ./content
COPY server.mjs ./server.mjs
COPY scripts/reset-password.mjs ./scripts/reset-password.mjs
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME /app/data
EXPOSE 4173
CMD ["node", "server.mjs"]

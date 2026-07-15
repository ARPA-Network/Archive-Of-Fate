
FROM node:20-slim AS build
WORKDIR /app
COPY src/back-end/package*.json ./
RUN npm ci
COPY src/back-end/ ./
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data/zh DATA_DIR_EN=/data/en
COPY src/back-end/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

COPY game-data/zh /data/zh
COPY game-data/en /data/en
EXPOSE 8080
CMD ["node", "dist/index.js"]

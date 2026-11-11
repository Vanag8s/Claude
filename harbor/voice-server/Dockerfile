# Build from the harbor/ folder:  docker build -f voice-server/Dockerfile .
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY api/_lib ./api/_lib
COPY config ./config
COPY voice-server ./voice-server
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "voice-server/server.js"]

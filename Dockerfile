# Global Temple Directory: Node API + static front-end in one image. Needs only DATABASE_URL (any Postgres >= 12).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/scripts/start.js"]

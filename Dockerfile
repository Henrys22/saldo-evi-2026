FROM node:24.21.0-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src/ ./src/
COPY public/ ./public/

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]

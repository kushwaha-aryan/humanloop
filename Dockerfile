# syntax=docker/dockerfile:1

# ---- Build the frontend -----------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- Runtime: Express serves the API and the built app ----------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "server/index.js"]

FROM node:20-alpine AS builder
RUN apk add --no-cache \
    build-base python3 \
    cairo-dev pango-dev giflib-dev libjpeg-turbo-dev \
    ttf-dejavu fontconfig
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache \
    cairo pango giflib libjpeg-turbo \
    ttf-dejavu fontconfig
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
RUN mkdir -p data
VOLUME ["/app/data"]
CMD ["node", "dist/index.js"]

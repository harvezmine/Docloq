# DocLoq Frontend — Multi-stage Docker Build
# Vite build → Nginx static serve

# Stage 1: Build React app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Build-time environment variables (baked into static JS bundle)
ARG VITE_API_URL=https://api.docloq.site/api
ARG VITE_ONLYOFFICE_URL=https://office.docloq.site
ARG VITE_TURNSTILE_SITE_KEY
ARG VITE_APP_VERSION=1.1
ENV VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

# DocLoq Backend — Multi-stage Docker Build
# Node.js 22 Alpine with Sharp (native image processing)

# Stage 1: Install production dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
# Sharp downloads prebuilt binaries (including bundled libvips) automatically.
# Do NOT install vips-dev — it forces sharp to build from source.
RUN npm ci --omit=dev

# Stage 2: Production runtime
FROM node:22-alpine
# curl/tini for healthcheck + init; fontconfig/freetype required by @napi-rs/canvas
# (PDF→image rendering for OCR). napi-rs ships prebuilt binaries; these are its runtime libs.
# poppler-utils provides `pdftoppm` — pixel-accurate PDF→PNG that works on Alpine/musl
# (pdfjs+@napi-rs/canvas crashes painting glyphs there). Used for share/task previews + OCR.
# pg_dump for backups
RUN apk add --no-cache curl tini fontconfig freetype font-noto poppler-utils postgresql16-client
RUN addgroup -S docloq && adduser -S docloq -G docloq

WORKDIR /app

# Copy dependencies from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY drizzle/ ./drizzle/
COPY contracts/ ./contracts/
COPY drizzle.config.js ./
COPY package.json ./

# OCR assets: self-hosted Tesseract traineddata (eng/ind/osd). Required so OCR does
# not fetch language data from a CDN at runtime.
COPY vendor/ ./vendor/

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Create required directories
RUN mkdir -p storage/temp storage/documents storage/qr-codes storage/thumbnails \
    && chown -R docloq:docloq /app

USER docloq

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]
CMD ["node", "src/index.js"]

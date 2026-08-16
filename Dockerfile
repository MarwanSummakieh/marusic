# Marusic — Node 22 (built-in SQLite) + the standalone yt-dlp binary.
# ffmpeg comes from the ffmpeg-static npm package (linux build inside the image).
FROM node:22-bookworm-slim

# Standalone yt-dlp (PyInstaller build — no Python needed in the image).
# TARGETARCH is set by BuildKit: amd64 → yt-dlp_linux, arm64 → yt-dlp_linux_aarch64,
# so the same Dockerfile builds on x86 and ARM NAS boxes.
ARG TARGETARCH
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates; \
    case "${TARGETARCH:-amd64}" in \
      arm64) suffix=_aarch64 ;; \
      *)     suffix= ;; \
    esac; \
    curl -fL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux${suffix}" \
      -o /usr/local/bin/yt-dlp; \
    chmod +x /usr/local/bin/yt-dlp; \
    apt-get purge -y curl; apt-get autoremove -y; rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    YTDLP_PATH=/usr/local/bin/yt-dlp

# The SQLite database lives here — mount a volume to keep libraries across
# container upgrades: docker run -v marusic-data:/app/data ...
VOLUME /app/data

EXPOSE 3000
# Production refuses to boot without real ADMIN_EMAIL / ADMIN_PASSWORD env vars.
CMD ["node", "--experimental-sqlite", "server.js"]

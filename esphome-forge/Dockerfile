ARG BUILD_FROM
FROM $BUILD_FROM

# ── System-Pakete ─────────────────────────────────────────────────────────────
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-wheel \
    nodejs \
    npm \
    git

# ── Python Backend ────────────────────────────────────────────────────────────
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY backend/ .

# ── Frontend Build ────────────────────────────────────────────────────────────
# npm ci nutzt package-lock.json fuer reproduzierbare Builds.
# vite.config.ts: outDir '../frontend-dist' -> landet in /app/frontend-dist
WORKDIR /app/frontend-src
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline 2>/dev/null || npm install

COPY frontend/ ./
RUN npm run build && mv /app/frontend-dist /app/frontend

# ── Run-Script ────────────────────────────────────────────────────────────────
COPY run.sh /
RUN chmod +x /run.sh

# ── Custom Boards Verzeichnis initialisieren ──────────────────────────────────
RUN mkdir -p /share/esphome-forge/custom_boards

EXPOSE 7052

CMD ["/run.sh"]

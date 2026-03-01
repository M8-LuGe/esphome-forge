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
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY backend/ .

# ── ESPHome-Schema vorab laden (optional – wird beim ersten Start nachgeladen) ────────────────
RUN mkdir -p /app/backend/components/cache/schema \
    && ( wget -qO /tmp/schema.zip \
         "https://github.com/esphome/esphome-schema/releases/latest/download/schema.zip" \
       && python3 -c "import zipfile,io,pathlib; \
       z=zipfile.ZipFile('/tmp/schema.zip'); \
       [pathlib.Path(f'/app/backend/components/cache/schema/{i.filename.split(\"/\")[-1]}').write_bytes(z.read(i)) \
        for i in z.infolist() if not i.is_dir() and i.filename.endswith('.json')]; \
       print(f'Extracted {len([i for i in z.infolist() if i.filename.endswith(\".json\")])} schemas')" \
       && rm /tmp/schema.zip \
       && echo "Schema pre-loaded successfully" ) \
    || echo "Schema pre-download skipped – will fetch at first runtime start"

# ── Frontend Build ────────────────────────────────────────────────────────────
WORKDIR /app/frontend-src
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline 2>/dev/null || npm install

COPY frontend/ ./
RUN npm run build \
    && mv /app/frontend-dist /app/frontend \
    && rm -rf /app/frontend-src node_modules

# ── Run-Script ────────────────────────────────────────────────────────────────
COPY run.sh /
RUN chmod a+x /run.sh

WORKDIR /app/backend
EXPOSE 7052
CMD ["/run.sh"]

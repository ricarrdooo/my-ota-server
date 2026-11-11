FROM node:24-alpine AS ui
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OTA_DATA_DIR=/data
WORKDIR /app
COPY requirements.lock /app/requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && useradd --uid 10001 --create-home ota && mkdir /data && chown ota:ota /data
COPY --chown=ota:ota ota_server /app/ota_server
COPY --from=ui --chown=ota:ota /src/ota_server/static/admin /app/ota_server/static/admin
USER ota
EXPOSE 8000
CMD ["python", "-m", "ota_server", "serve", "--host", "0.0.0.0"]

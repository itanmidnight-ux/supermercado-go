FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias de sistema para better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar codigo fuente
COPY src/ ./src/

# Crear directorios de datos
RUN mkdir -p data/uploads data/reports data/invoices data/wa-session

# Puerto
EXPOSE 3777

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3777/api/health || exit 1

# Usuario no-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

CMD ["node", "src/index.js"]

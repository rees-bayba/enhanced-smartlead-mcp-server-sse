FROM node:18-alpine

# Install Supergateway globally
RUN npm install -g supergateway

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --production

# Set default port
ENV PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/healthz || exit 1

# Start with Supergateway - same as working original
CMD ["sh", "-c", "supergateway --command='node dist/index.js' --port=$PORT --logLevel=info"]

EXPOSE $PORT

FROM node:18-alpine

# Install required tools
RUN apk add --no-cache curl

# Install Supergateway globally
RUN npm install -g supergateway

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including TypeScript for build)
RUN npm install

# Copy all source files
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --production

# Set default port
ENV PORT=8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/healthz || exit 1

# CRITICAL: Use proper Supergateway command with --stdio flag
CMD ["sh", "-c", "supergateway --stdio 'node dist/index.js' --port=$PORT --logLevel=info"]

EXPOSE $PORT

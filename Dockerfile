FROM node:18-alpine

# Install Supergateway globally
RUN npm install -g supergateway

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (no build step needed)
COPY . .

# Set default port
ENV PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/healthz || exit 1

# Start with Supergateway - run TypeScript directly with ts-node
CMD ["sh", "-c", "npx ts-node src/index.ts | supergateway --port=$PORT --logLevel=info"]

EXPOSE $PORT

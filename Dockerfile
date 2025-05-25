# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies for build)
COPY package*.json ./

# Install dependencies - use npm ci if lock file exists, otherwise npm install
RUN if [ -f "package-lock.json" ]; then npm ci --ignore-scripts; else npm install; fi

# Copy the rest of the application source code
COPY . .

# Run the build script
RUN npm run build

# Stage 2: Create the production image
FROM node:22-alpine AS release

WORKDIR /app

ENV NODE_ENV production

# Copy package files from the builder
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN if [ -f "package-lock.json" ]; then npm ci --omit=dev --ignore-scripts; else npm install --omit=dev; fi

# Copy the built application from the builder stage
# Assuming the build output is in the 'dist' directory
COPY --from=builder /app/dist ./dist

# Expose the port Supergateway will listen on
EXPOSE 8000

# Command to run Supergateway, which in turn runs the Smartlead MCP server via stdio.
# Railway will set the PORT environment variable. Supergateway will use this PORT.
# The Smartlead server (node dist/index.js) will inherit environment variables.
CMD ["sh", "-c", "npx -y supergateway --stdio \"node dist/index.js\" --port ${PORT:-8000} --healthEndpoint /healthz --cors --logLevel info"]

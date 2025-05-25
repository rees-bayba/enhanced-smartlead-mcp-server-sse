# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies for build)
COPY package.json package-lock.json ./

# Use npm ci for reproducible builds and --ignore-scripts if build is part of prepare
RUN npm ci --ignore-scripts

# Copy the rest of the application source code
COPY . .

# Run the build script
RUN npm run build

# Stage 2: Create the production image
FROM node:22-alpine AS release

WORKDIR /app

ENV NODE_ENV production

# Copy package files from the builder (or host, but builder ensures consistency)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy the built application from the builder stage
# Assuming the build output is in the 'dist' directory
COPY --from=builder /app/dist ./dist

# Expose the port Supergateway will listen on
EXPOSE 8000

# Command to run Supergateway, which in turn runs the Smartlead MCP server via stdio.
# Railway will set the PORT environment variable. Supergateway will use this PORT.
# The Smartlead server (node dist/index.js) will inherit environment variables.
CMD ["sh", "-c", "npx -y supergateway --stdio \"node dist/index.js\" --port ${PORT:-8000} --healthEndpoint /healthz --cors --logLevel info"]

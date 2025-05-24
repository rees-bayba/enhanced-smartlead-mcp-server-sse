FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for TypeScript)
RUN npm install

# Copy the rest of the application
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies after building
RUN npm prune --production

# Use Supergateway to wrap the stdio server
CMD ["npx", "supergateway", "--command", "node", "build/index.js"]

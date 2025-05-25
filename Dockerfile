FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for TypeScript)
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Install supergateway globally
RUN npm install -g supergateway

# Expose the port
EXPOSE 8080

# Use the start script which runs Supergateway
CMD ["npm", "start"]

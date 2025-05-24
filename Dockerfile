FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application
COPY . .

# Build the TypeScript code
RUN npm run build

# Use Supergateway to wrap the stdio server
CMD ["npx", "supergateway", "--command", "node", "build/index.js"]

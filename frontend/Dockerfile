# Multi-stage build for Railway deployment
# Use multiple fallback images to handle Docker Hub connectivity issues
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Copy build script
COPY scripts/railway-build.sh ./scripts/
RUN chmod +x ./scripts/railway-build.sh

# Install all dependencies (including dev dependencies for build)
# Use npm ci with retry mechanism for Railway's network issues
RUN npm ci --frozen-lockfile --retry=3 --retry-delay=5000 || \
    (echo "First attempt failed, trying with cache clean..." && \
     npm cache clean --force && \
     npm ci --frozen-lockfile --retry=3 --retry-delay=5000)

# Copy source code
COPY . .

# Build the application using robust build script
RUN ./scripts/railway-build.sh

# Clean up dev dependencies to reduce image size
RUN npm prune --production

# Production stage
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /app

# Install serve for static file serving
RUN npm install -g serve

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["serve", "-s", "dist", "-l", "3000"]

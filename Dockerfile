# Stage 1: Base image with dependencies
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
# Use --frozen-lockfile to ensure reproducible builds
RUN bun install --frozen-lockfile

# Stage 2: Builder for the application
FROM base AS builder
WORKDIR /app

# Copy all source code. .dockerignore should exclude node_modules etc.
COPY . .

# Set dummy env vars for prisma generate
ENV DATABASE_PROVIDER="sqlite"
ENV DATABASE_URL="file:./dev.db"

# Generate prisma client
RUN bunx prisma generate

# Build the frontend application
RUN bun run build

# Stage 3: Production image
FROM oven/bun:1 AS production
WORKDIR /app

# Copy package.json and bun.lock to install only production dependencies
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# Copy built artifacts and necessary source code from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/auth.ts ./auth.ts
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/types ./types

# Expose the port the server will run on
EXPOSE 3000

# Define the command to run the application
# The start script from package.json will be executed
CMD ["bun", "start"]
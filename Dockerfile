# Stage 1: Base image with dependencies
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Use --frozen-lockfile to ensure reproducible builds
RUN bun install --frozen-lockfile
# Install openssl to prevent Prisma warnings

# Stage 2: Builder for the application
FROM base AS builder
WORKDIR /app

# Copy prisma schema and generate client first to leverage Docker cache
COPY prisma ./prisma
ENV DATABASE_URL="file:./dev.db"
# This now works because binaryTargets is set in your schema
RUN bunx prisma generate

# Copy all source code. .dockerignore should exclude node_modules etc.
COPY . .

# Build the frontend application
RUN bun run build
FROM oven/bun:1 AS production
WORKDIR /app

# Install openssl for runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy production dependencies from the 'base' stage
COPY --from=base /app/node_modules ./node_modules
COPY package.json bun.lock ./

# Copy built artifacts and necessary source from the builder stage
# This is much cleaner than copying many individual files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts

# Your package.json "start" script should run the compiled server, e.g., "bun run server.ts"
# Make sure your production start script does not rely on dev dependencies.

# Expose the port the server will run on
EXPOSE 3000



# Define the command to run the application
CMD ["/bin/sh", "-c", "bunx prisma migrate deploy --schema=./prisma/schema.prisma && bun server.ts"]
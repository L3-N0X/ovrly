# Stage 1: Base image with dependencies
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile

# Stage 2: Builder for the application
FROM base AS builder
WORKDIR /app

# Copy prisma schema and generate client first to leverage Docker cache
COPY prisma ./prisma
RUN bunx prisma generate

# 1. Accept the build argument
ARG VITE_GOOGLE_FONTS_API_KEY

# 2. Set it as an environment variable FOR THIS BUILD STAGE
ENV VITE_GOOGLE_FONTS_API_KEY=${VITE_GOOGLE_FONTS_API_KEY}

# Copy all source code. .dockerignore should exclude node_modules etc.
COPY . .

# Build the frontend application
RUN bun run build
FROM oven/bun:1 AS production
WORKDIR /app

# Install openssl for runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY package.json bun.lock ./

# Copy built artifacts and necessary source from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/auth.ts ./auth.ts
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/public ./public
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/types ./types

# Expose the port the server will run on
EXPOSE 3000

# Define the command to run the application
CMD ["/bin/sh", "-c", "bunx prisma migrate deploy --schema=./prisma/schema.prisma && bun server.ts"]
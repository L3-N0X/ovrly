# Stage 1: Base image with dependencies
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./

# `postinstall` runs from package.json during install, so the script has to be
# present before `bun install` executes.
COPY scripts ./scripts

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Prisma's schema engine (used by `prisma migrate deploy`) needs openssl at
# runtime, so keep dev dependencies available in the production image.
RUN bun install --frozen-lockfile

# Stage 2: Builder for the application
FROM base AS builder
WORKDIR /app

# `prisma generate` does not need a database connection, so no DATABASE_URL here.
COPY prisma ./prisma
COPY prisma.config.ts ./
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

# Install openssl for the Prisma schema engine and ca-certificates for TLS
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY prisma.config.ts ./

# Copy built artifacts and necessary source from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/auth.ts ./auth.ts
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/public ./public
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/types ./types

# Expose the port the server will run on
EXPOSE 3000

CMD ["/bin/sh", "-c", "bunx prisma migrate deploy && bun server.ts"]
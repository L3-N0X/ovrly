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

# Copy the whole builder tree in one step.
#
# This deliberately does NOT enumerate the directories the server needs
# (routes/, lib/, services/, middleware/, types/, auth.ts, ...). An allowlist
# has to be edited by hand whenever server code is added or moved, and when it
# is forgotten the image still builds and then dies on startup with
# "Cannot find module" (which is exactly how lib/ went missing once already).
# Listing what to exclude instead means new server code is included by default.
#
# .dockerignore applies to the `COPY . .` in the builder stage, so the build
# context never carries .git or .env* into this image. node_modules and dist
# come from the builder's `bun install` and `bun run build` rather than the
# context, and src/generated is the copy that `prisma generate` wrote above --
# so everything the server actually imports at runtime lands in /app.
#
# The trade-off is that the frontend source ships too, measured at ~727 KB on an
# image of ~1.07 GB. Not worth trading for a list that has to be kept in sync.
#
# node_modules comes along from the builder's `bun install`, which keeps the
# Prisma CLI available for `migrate deploy` in the CMD below.
COPY --from=builder /app ./

# Expose the port the server will run on
EXPOSE 3000

CMD ["/bin/sh", "-c", "bunx prisma migrate deploy && bun server.ts"]
# Stage 1: Install all dependencies
FROM oven/bun:1 AS deps

WORKDIR /app

# Copy dependency management files
COPY package.json bun.lock ./

# Install all dependencies including devDependencies
RUN bun install

# Stage 2: Build the frontend
FROM deps AS builder

WORKDIR /app

# Copy all files
COPY . .

# Set dummy env vars for prisma generate
ENV DATABASE_PROVIDER="sqlite"
ENV DATABASE_URL="file:./dev.db"

# Generate prisma client
RUN bunx prisma generate

# Build the frontend application
RUN bun run build

# Stage 3: Create the production image
FROM oven/bun:1

WORKDIR /app

# Install production dependencies
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --production

# Copy the backend source code
COPY ./server.ts ./
COPY ./auth.ts ./
COPY ./middleware ./middleware
COPY ./routes ./routes
COPY ./services ./services
COPY ./types ./types
COPY ./prisma ./prisma

# Copy the built frontend and public assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose the port the server will run on
EXPOSE 3000

# Define the command to run the application
CMD ["bun", "start"]

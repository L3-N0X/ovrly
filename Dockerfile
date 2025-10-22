# Stage 1: Build the frontend
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy dependency management files
COPY package.json bun.lockb ./

# Install all dependencies
RUN bun install

# Copy the rest of the application source code
COPY . .

# Generate prisma client
RUN bunx prisma generate

# Build the frontend application
RUN bun run build

# Stage 2: Create the production image
FROM oven/bun:1-slim

WORKDIR /app

# Copy production dependencies from the builder stage
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/bun.lockb ./

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
CMD ["bun", "server.ts"]

# Stage 1: Build
FROM node:24-slim AS builder
WORKDIR /app

COPY package*.json ./

# Cache the npm cache for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .

# Stage 2: Production
FROM node:24-slim AS final 
WORKDIR /app

RUN groupadd -r mynodegroup && useradd -r -g mynodegroup nodeuser

COPY --from=builder --chown=nodeuser:mynodegroup /app .

# Switch to the non-root user
USER nodeuser


CMD ["node", "index.js"]
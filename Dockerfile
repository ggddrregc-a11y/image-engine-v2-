FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all packages
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/

# Install dependencies (no frozen lockfile)
RUN pnpm install --no-frozen-lockfile

# Set dummy env vars needed by Replit-specific vite configs during build
ENV PORT=3000
ENV BASE_PATH=/

# Build only api-server and image-engine (skip mockup-sandbox)
RUN pnpm run typecheck
RUN pnpm --filter "./artifacts/api-server" --filter "./artifacts/image-engine" --if-present run build

# Start the api-server
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]

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

# Build only the necessary packages (skip mockup-sandbox - it's Replit-only)
RUN pnpm run typecheck
RUN pnpm --filter "./artifacts/api-server" --filter "./artifacts/image-engine" --if-present run build

# Start the api-server
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]

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

# Build all packages
RUN pnpm run build

# Start the api-server
CMD ["npm", "run", "start"]

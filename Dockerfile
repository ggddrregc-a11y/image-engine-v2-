FROM node:20-slim

# Install system dependencies + yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
ENV VITE_SUPABASE_URL=https://irwhkqrpexblmrhfalge.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyd2hrcXJwZXhibG1yaGZhbGdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjM2MTQsImV4cCI6MjEwMTM5OTYxNH0.KxX2wIPuev1fZPWH4rhy5AVSFocqCZIZ9gNIt-_7dck

# Build only api-server and image-engine (skip mockup-sandbox)
RUN pnpm run typecheck
RUN pnpm --filter "./artifacts/api-server" --filter "./artifacts/image-engine" --if-present run build

# Start the api-server
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]

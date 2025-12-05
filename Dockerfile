# --- Build TypeScript ---
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Final image from Node + Ollama ---
FROM node:20-slim
WORKDIR /app

# Install Ollama
RUN apt-get update && apt-get install -y curl ca-certificates gnupg && \
    curl -L --retry 5 --retry-delay 3 -o /tmp/ollama_install.sh https://ollama.com/install.sh && \
    chmod +x /tmp/ollama_install.sh && \
    /tmp/ollama_install.sh && \
    rm -rf /var/lib/apt/lists/*


# Copy build files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE 3000 11434

# Default model (can be overridden at runtime)
ENV OLLAMA_MODEL=qwen3:30b,qwen3:4b,

# Start via entrypoint
CMD ["/entrypoint.sh"]

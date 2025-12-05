#!/bin/bash

set -e

# Start Ollama in background
ollama serve &

# Wait for Ollama to be ready
sleep 3

# Preload models if environment variable is set
# Example: OLLAMA_MODELS="llama3.1,mistral,qwen2.5:7b"
if [ -n "$OLLAMA_MODELS" ]; then
  IFS=',' read -ra MODELS <<< "$OLLAMA_MODELS"
  echo "Preloading models: ${MODELS[@]}"

  for MODEL in "${MODELS[@]}"; do
    if ! ollama list | grep -q "$MODEL"; then
      echo "Pulling model: $MODEL"
      ollama pull "$MODEL"
    else
      echo "Model already exists: $MODEL"
    fi
  done
fi

# Start Node server
node dist/index.js

#!/usr/bin/env bash
# Run Hindsight locally in Docker.
#   API:            http://localhost:8888
#   Control plane:  http://localhost:9999   (browse memories, observations, mental models)
# Data persists in ~/.hindsight-docker, so restarts keep the memory bank.
#
# Provider comes from backend/.env: HINDSIGHT_LLM_PROVIDER=vertexai (default) or groq.
#   vertexai: uses your gcloud Application Default Credentials (run `gcloud auth application-default login` once)
#   groq:     uses GROQ_API_KEY (free tier is rate-limited to ~2 memories/min)
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r"' || true; }

PROVIDER=$(envval HINDSIGHT_LLM_PROVIDER); PROVIDER=${PROVIDER:-vertexai}
MODEL=$(envval HINDSIGHT_LLM_MODEL)
mkdir -p "$HOME/.hindsight-docker"
DATA_WIN=$(cd "$HOME/.hindsight-docker" && (pwd -W 2>/dev/null || pwd))   # Windows path under Git Bash
ARGS=(-p 8888:8888 -p 9999:9999 -v "$DATA_WIN:/home/hindsight/.pg0")

if [ "$PROVIDER" = "vertexai" ]; then
  PROJECT=$(envval VERTEX_PROJECT); REGION=$(envval VERTEX_LOCATION); REGION=${REGION:-global}
  ADC_DIR="${APPDATA:-$HOME/.config}/gcloud"
  [ -f "$ADC_DIR/application_default_credentials.json" ] || ADC_DIR="$HOME/.config/gcloud"
  [ -f "$ADC_DIR/application_default_credentials.json" ] || { echo "No ADC found. Run: gcloud auth application-default login"; exit 1; }
  [ -n "$PROJECT" ] || { echo "VERTEX_PROJECT is empty in backend/.env"; exit 1; }
  ADC_WIN=$(cd "$ADC_DIR" && pwd -W 2>/dev/null || pwd)
  ARGS+=(-v "$ADC_WIN:/gcloud:ro"
         -e GOOGLE_APPLICATION_CREDENTIALS=/gcloud/application_default_credentials.json
         -e GOOGLE_CLOUD_PROJECT="$PROJECT"
         -e HINDSIGHT_API_LLM_PROVIDER=vertexai
         -e HINDSIGHT_API_LLM_VERTEXAI_PROJECT_ID="$PROJECT"
         -e HINDSIGHT_API_LLM_VERTEXAI_REGION="$REGION"
         -e HINDSIGHT_API_LLM_MODEL="${MODEL:-gemini-3-flash-preview}"
         -e HINDSIGHT_API_LLM_MAX_CONCURRENT=8)
else
  KEY=$(envval GROQ_API_KEY); [ -n "$KEY" ] || { echo "GROQ_API_KEY is empty in backend/.env"; exit 1; }
  ARGS+=(-e HINDSIGHT_API_LLM_PROVIDER=groq
         -e HINDSIGHT_API_LLM_API_KEY="$KEY"
         -e HINDSIGHT_API_LLM_MODEL="${MODEL:-openai/gpt-oss-20b}"
         -e HINDSIGHT_API_LLM_GROQ_SERVICE_TIER=on_demand
         -e HINDSIGHT_API_LLM_MAX_CONCURRENT=3)
fi

docker rm -f tareekh-hindsight >/dev/null 2>&1 || true
MSYS_NO_PATHCONV=1 docker run -d --name tareekh-hindsight --restart unless-stopped "${ARGS[@]}" \
  ghcr.io/vectorize-io/hindsight:latest
echo "Starting Hindsight ($PROVIDER)... logs: docker logs -f tareekh-hindsight"

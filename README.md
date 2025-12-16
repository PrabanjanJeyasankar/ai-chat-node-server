# AI Chat Server

## Complete Documentation

https://www.notion.so/Minimal-AI-Customer-Support-Agent-2c23b149d4c180c6a0a8ce0a190c5166?source=copy_link

## Diagram

![App Flow Diagram](./App-Flow.png)

## Installation (Docker)

Prerequisites:

- Docker + Docker Compose

Steps:

1. `cd server-ai-chat`
2. `cp .env.example .env`
3. Update `.env` with your values
4. `docker compose up --build`

Stop:

- `docker compose down`

## Environment (`.env`)

Create your `.env` from `.env.example`. Do not commit secrets.

- Server: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `CORS_ORIGIN`
- Database: `MONGO_URI`
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY`
- Vector DB: `QDRANT_URL`
- AI provider: `AI_PROVIDER` (`openai` or `ollama`)
- OpenAI (chat): `OPENAI_API_KEY`, `OPENAI_MODEL`
- Gemini (embeddings): `GEMINI_API_KEY`, `GEMINI_MODEL`
- Ollama: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- Redis cache: `REDIS_URL`, `CHAT_HISTORY_CACHE_TTL_SECONDS`, `CHAT_HISTORY_CACHE_MAX_MESSAGES`, `CHAT_HISTORY_IN_MEMORY_MAX_CHATS`
- Reranker: `RERANKER_URL`, `RERANKER_MODEL`, `ENABLE_RERANKING`

Docker Compose overrides:

- `DOCKER_REDIS_URL` (defaults to `redis://redis:6379`)
- `DOCKER_RERANKER_URL` (defaults to `http://reranker:8000/rerank`)

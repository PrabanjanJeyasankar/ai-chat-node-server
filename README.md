# AI Chat Server

A Node.js backend for an AI chat application, supporting authentication, vector storage with Qdrant, and AI model integration via Gemini.

## Prerequisites

- Node.js
- MongoDB
- Qdrant (Vector Database)

## Installation

1. Install dependencies:
   npm install

2. Configure environment variables:
   cp .env.example .env

   Update the .env file with your configuration details (MongoDB URI, Qdrant URL, Gemini API Key, etc.).

## Usage

Development:
npm run dev

Production:
npm start

## Environment Variables

- NODE_ENV: Environment (development/production)
- PORT: Application port (default 3000)
- MONGO_URI: MongoDB connection string
- JWT_SECRET: Secret for JWT signing
- QDRANT_URL: URL for Qdrant vector database
- AI_PROVIDER: AI provider service (e.g., gemini)
- GEMINI_API_KEY: API key for Google Gemini
- GEMINI_MODEL: Model name for Gemini

## API Endpoints

- /auth: Authentication routes (signup, login)
- /chat: Chat management routes
- /message: Message handling routes
- /search: Semantic search routes

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

# Documentation Index

Welcome to the AI Chat Server documentation. This guide provides comprehensive information about the APIs, deployment pipeline, and infrastructure.

## 📚 Documentation Files

### [API Documentation](docs/API_DOCUMENTATION.md)

Complete reference for all API endpoints including:

- Authentication endpoints (signup, login, profile)
- Chat management (create, list, rename, delete)
- Message operations (send, edit, regenerate)
- Search functionality (semantic search across messages)
- Request/response formats
- Error handling
- Rate limiting

### [CI/CD Pipeline](docs/CI_CD_PIPELINE.md)

Continuous Integration and Deployment documentation:

- GitHub Actions workflow configuration
- Automated deployment process
- Secrets management
- Troubleshooting guide
- Best practices
- Rollback procedures

### [AWS Infrastructure](docs/AWS_INFRASTRUCTURE.md)

Cloud infrastructure and deployment architecture:

- EC2 instance configuration
- Docker container architecture
- Security group setup
- Monitoring and logging
- Backup and disaster recovery
- Cost optimization
- Scaling strategies

## 🚀 Quick Start

### For API Consumers

1. Read the [API Documentation](docs/API_DOCUMENTATION.md)
2. Obtain an API token by signing up
3. Start making requests to the endpoints

### For Developers

1. Review the [CI/CD Pipeline](docs/CI_CD_PIPELINE.md) to understand the deployment process
2. Check the [AWS Infrastructure](docs/AWS_INFRASTRUCTURE.md) for environment setup
3. Configure GitHub Secrets for automated deployment

### For DevOps Engineers

1. Start with [AWS Infrastructure](docs/AWS_INFRASTRUCTURE.md) for server setup
2. Configure [CI/CD Pipeline](docs/CI_CD_PIPELINE.md) for automated deployments
3. Set up monitoring and backups as described

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│         API Server (EC2)            │
│  ┌────────────────────────────┐    │
│  │  Express.js Application    │    │
│  │  - Authentication          │    │
│  │  - Chat Management         │    │
│  │  - Message Processing      │    │
│  │  - Search                  │    │
│  └────────┬──────────┬────────┘    │
│           │          │              │
│     ┌─────▼──┐  ┌───▼──────┐      │
│     │MongoDB │  │  Qdrant  │      │
│     │        │  │ (Vector) │      │
│     └────────┘  └──────────┘      │
└─────────────────────────────────────┘
           │
           ▼
    ┌──────────────┐
    │  Gemini API  │
    │  (Google)    │
    └──────────────┘
```

## 🔑 Key Features

- **JWT Authentication**: Secure user authentication with JSON Web Tokens
- **AI-Powered Chat**: Integration with Google Gemini for intelligent responses
- **Semantic Search**: Vector-based search using Qdrant for finding relevant messages
- **Rate Limiting**: Protection against abuse with configurable rate limits
- **Automated Deployment**: GitHub Actions CI/CD pipeline for seamless updates
- **Containerized**: Docker-based deployment for consistency and portability
- **Scalable Architecture**: Designed to scale horizontally with load balancers

## 🛠️ Technology Stack

### Backend

- **Runtime**: Node.js 20
- **Framework**: Express.js 5
- **Database**: MongoDB 7
- **Vector DB**: Qdrant v1.16
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod

### AI Integration

- **Provider**: Google Gemini
- **Model**: gemini-2.5-flash-lite
- **Use Case**: Chat completions and embeddings

### Infrastructure

- **Cloud Provider**: AWS
- **Compute**: EC2 (t3.medium recommended)
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Networking**: VPC, Security Groups

### Security

- **Password Hashing**: bcrypt
- **Rate Limiting**: express-rate-limit
- **CORS**: Configurable origins
- **Environment Variables**: dotenv

## 📖 API Base URL

```
https://your-domain.com/api/v1
```

## 🔐 Authentication Flow

1. **Sign Up**: `POST /api/v1/auth/signup`
2. **Login**: `POST /api/v1/auth/login`
3. **Get Token**: Receive JWT token in response
4. **Use Token**: Include in `Authorization: Bearer <token>` header
5. **Access Protected Routes**: Make authenticated requests

## 📊 Monitoring

### Health Check

```bash
curl https://your-domain.com/api/v1/health
```

### Container Status

```bash
docker compose ps
docker compose logs -f
```

### System Resources

```bash
docker stats
df -h
```

## 🔄 Deployment Workflow

1. **Push Code**: Commit and push to `main` branch
2. **Trigger CI/CD**: GitHub Actions automatically starts
3. **Deploy**: Code is pulled and containers are rebuilt on EC2
4. **Verify**: Check health endpoint and logs

## 📝 Environment Variables

Required environment variables (see `.env.example`):

```bash
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb://...
JWT_SECRET=your_secret
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash-lite
QDRANT_URL=http://qdrant:6333
CORS_ORIGIN=*
LOG_LEVEL=info
```

## 🐛 Troubleshooting

### API Not Responding

1. Check container status: `docker compose ps`
2. View logs: `docker compose logs server`
3. Verify environment variables
4. Check security group rules

### Database Connection Issues

1. Verify MongoDB is running: `docker compose ps mongo`
2. Check connection string in `.env`
3. Test connection: `docker exec -it mongo-db mongosh`

### Deployment Failures

1. Check GitHub Actions logs
2. Verify GitHub Secrets are configured
3. SSH into EC2 and check manually
4. Review Docker build logs

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Docker Documentation](https://docs.docker.com/)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## 🤝 Support

For issues or questions:

1. Check the relevant documentation file
2. Review troubleshooting sections
3. Check application logs
4. Review GitHub Actions workflow runs

## 📄 License

This documentation is provided for reference and usage of the AI Chat Server.

## 🔄 Version History

- **v1.0.0**: Initial release with core chat functionality
- Gemini API integration
- Vector search with Qdrant
- Automated CI/CD pipeline
- AWS EC2 deployment

---

**Last Updated**: December 2024

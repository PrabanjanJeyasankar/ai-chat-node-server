# AWS Infrastructure Documentation

## Overview

This application is deployed on **Amazon Web Services (AWS)** using a containerized architecture with Docker Compose. The infrastructure consists of an EC2 instance running multiple Docker containers for the application server, database, and vector search engine.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS/HTTP
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS EC2 Instance                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Docker Network (ai-network)                   │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   Server     │  │   MongoDB    │  │   Qdrant     │   │  │
│  │  │  Container   │  │  Container   │  │  Container   │   │  │
│  │  │              │  │              │  │              │   │  │
│  │  │  Port: 3000  │  │  Port: 27017 │  │  Port: 6333  │   │  │
│  │  │              │  │              │  │              │   │  │
│  │  │  Node.js     │◄─┤  Database    │  │  Vector DB   │   │  │
│  │  │  Express     │  │              │  │              │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Docker Volumes                                │  │
│  │  • mongo_data (MongoDB persistence)                        │  │
│  │  • qdrant_storage (Qdrant persistence)                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## AWS Services Used

### 1. Amazon EC2 (Elastic Compute Cloud)

**Purpose**: Hosts the application and all services

**Instance Type**: Recommended minimum

- **Type**: t3.medium or t3a.medium
- **vCPUs**: 2
- **Memory**: 4 GB RAM
- **Storage**: 20-30 GB EBS volume
- **Architecture**: ARM64 (Graviton) or x86_64

**Operating System**:

- Ubuntu 20.04 LTS or later
- Amazon Linux 2023

**Why EC2?**

- Full control over the environment
- Cost-effective for small to medium workloads
- Easy Docker integration
- Flexible scaling options

---

## EC2 Instance Configuration

### Security Group Rules

#### Inbound Rules

| Type       | Protocol | Port Range | Source                   | Description                                 |
| ---------- | -------- | ---------- | ------------------------ | ------------------------------------------- |
| SSH        | TCP      | 22         | Your IP / GitHub Actions | Remote access                               |
| HTTP       | TCP      | 80         | 0.0.0.0/0                | Web traffic (if using reverse proxy)        |
| HTTPS      | TCP      | 443        | 0.0.0.0/0                | Secure web traffic (if using reverse proxy) |
| Custom TCP | TCP      | 3000       | 0.0.0.0/0 or VPC only    | Application port                            |

#### Outbound Rules

| Type        | Protocol | Port Range | Destination | Description        |
| ----------- | -------- | ---------- | ----------- | ------------------ |
| All traffic | All      | All        | 0.0.0.0/0   | Allow all outbound |

**Security Best Practices**:

- Restrict SSH access to specific IP addresses
- Use a reverse proxy (Nginx/Caddy) for production
- Enable HTTPS with SSL/TLS certificates
- Consider using AWS Systems Manager Session Manager instead of SSH

---

### IAM Role (Optional but Recommended)

Create an IAM role for the EC2 instance with the following permissions:

**Recommended Policies**:

- `AmazonSSMManagedInstanceCore` - For Systems Manager access
- `CloudWatchAgentServerPolicy` - For monitoring and logs
- `AmazonEC2ContainerRegistryReadOnly` - If using ECR for Docker images

---

## Docker Infrastructure

### Container Services

#### 1. Application Server Container

**Image**: Custom (built from Dockerfile)

**Base Image**: `node:20-slim`

**Exposed Port**: 3000

**Environment Variables**:

```bash
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb://mongo:27017/database_name
QDRANT_URL=http://qdrant:6333
AI_PROVIDER=gemini
GEMINI_API_KEY=<your_api_key>
GEMINI_MODEL=gemini-2.5-flash-lite
JWT_SECRET=<your_jwt_secret>
CORS_ORIGIN=*
LOG_LEVEL=info
```

**Restart Policy**: `always`

**Dependencies**:

- MongoDB container must be running
- Qdrant container must be running

---

#### 2. MongoDB Container

**Image**: `mongo:7`

**Exposed Port**: 27017

**Volume**: `mongo_data:/data/db`

**Purpose**:

- Stores user accounts
- Stores chat sessions
- Stores messages

**Restart Policy**: `always`

**Data Persistence**: Data is persisted in Docker volume `mongo_data`

---

#### 3. Qdrant Container

**Image**: `qdrant/qdrant:v1.16.0`

**Exposed Port**: 6333

**Volume**: `qdrant_storage:/qdrant/storage`

**Purpose**:

- Vector database for semantic search
- Stores message embeddings
- Enables similarity-based message retrieval

**Restart Policy**: `always`

**Data Persistence**: Data is persisted in Docker volume `qdrant_storage`

---

### Docker Network

**Network Name**: `ai-network`

**Type**: Bridge network

**Purpose**:

- Allows containers to communicate with each other
- Provides DNS resolution between containers
- Isolates application from host network

**Container Communication**:

- Server can access MongoDB at `mongodb://mongo:27017`
- Server can access Qdrant at `http://qdrant:6333`

---

### Docker Volumes

#### mongo_data

**Purpose**: Persist MongoDB data

**Location**: `/var/lib/docker/volumes/mongo_data`

**Backup Strategy**:

```bash
docker run --rm -v mongo_data:/data -v $(pwd):/backup ubuntu tar czf /backup/mongo_backup.tar.gz /data
```

#### qdrant_storage

**Purpose**: Persist Qdrant vector data

**Location**: `/var/lib/docker/volumes/qdrant_storage`

**Backup Strategy**:

```bash
docker run --rm -v qdrant_storage:/data -v $(pwd):/backup ubuntu tar czf /backup/qdrant_backup.tar.gz /data
```

---

## Deployment Architecture

### Application Deployment Process

1. **Code Push**: Developer pushes code to GitHub `main` branch
2. **CI/CD Trigger**: GitHub Actions workflow starts
3. **SSH Connection**: Workflow connects to EC2 instance
4. **Code Pull**: Latest code pulled from GitHub
5. **Container Stop**: Existing containers stopped
6. **Image Build**: New Docker images built
7. **Container Start**: New containers started with updated code

### Container Orchestration

**Tool**: Docker Compose

**Configuration File**: `docker-compose.yml`

**Commands**:

```bash
docker compose up -d      # Start all services
docker compose down       # Stop all services
docker compose logs -f    # View logs
docker compose restart    # Restart services
```

---

## External Service Integrations

### 1. MongoDB Atlas (Alternative)

Instead of self-hosted MongoDB, you can use MongoDB Atlas:

**Benefits**:

- Managed database service
- Automatic backups
- Better scalability
- Built-in monitoring

**Configuration**:

```bash
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
```

**Docker Compose Changes**:

- Remove `mongo` service
- Remove `mongo_data` volume
- Update `MONGO_URI` in server environment

---

### 2. Google Cloud (Gemini API)

**Service**: Google Gemini API

**Purpose**: AI language model for chat responses

**Configuration**:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=<your_google_api_key>
GEMINI_MODEL=gemini-2.5-flash-lite
```

**API Endpoint**: Managed by Google Cloud

**Billing**: Pay-per-use based on API calls

---

## Monitoring and Logging

### Application Logs

**Location on EC2**:

```bash
~/ai-chat-node-server/logs/
```

**Docker Logs**:

```bash
docker compose logs -f server
docker compose logs -f mongo
docker compose logs -f qdrant
```

**Log Levels**: error, warn, info, debug

---

### System Monitoring

#### CPU and Memory Usage

```bash
docker stats
```

#### Disk Usage

```bash
df -h
docker system df
```

#### Container Health

```bash
docker ps
docker compose ps
```

---

### CloudWatch Integration (Optional)

For production environments, integrate with AWS CloudWatch:

1. Install CloudWatch agent on EC2
2. Configure log groups for application logs
3. Set up metrics for CPU, memory, disk usage
4. Create alarms for critical thresholds

**Benefits**:

- Centralized logging
- Real-time monitoring
- Automated alerts
- Historical data analysis

---

## Scaling Strategies

### Vertical Scaling

Upgrade EC2 instance type:

- t3.medium → t3.large (4 GB → 8 GB RAM)
- t3.large → t3.xlarge (8 GB → 16 GB RAM)

**When to Scale Up**:

- High CPU usage (>80% sustained)
- Memory pressure
- Increased user load

---

### Horizontal Scaling

For high-traffic applications:

1. **Load Balancer**: Use AWS Application Load Balancer (ALB)
2. **Multiple EC2 Instances**: Run identical instances behind ALB
3. **Shared Database**: Use MongoDB Atlas or RDS
4. **Session Management**: Use Redis for session storage
5. **Auto Scaling Group**: Automatically add/remove instances

**Architecture**:

```
Internet → ALB → EC2 Instance 1 → MongoDB Atlas
                → EC2 Instance 2 → Qdrant Cloud
                → EC2 Instance 3
```

---

## Backup and Disaster Recovery

### Backup Strategy

#### 1. Database Backups

**MongoDB**:

```bash
docker exec mongo-db mongodump --out /backup
docker cp mongo-db:/backup ./mongo-backup-$(date +%Y%m%d)
```

**Qdrant**:

```bash
docker exec qdrant-db tar czf /tmp/qdrant-backup.tar.gz /qdrant/storage
docker cp qdrant-db:/tmp/qdrant-backup.tar.gz ./qdrant-backup-$(date +%Y%m%d).tar.gz
```

#### 2. Automated Backups

**Cron Job** (on EC2):

```bash
0 2 * * * /home/ubuntu/backup-script.sh
```

**Backup Script**:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
cd ~/ai-chat-node-server

docker exec mongo-db mongodump --out /backup
docker cp mongo-db:/backup ./backups/mongo-$DATE

aws s3 cp ./backups/mongo-$DATE s3://your-backup-bucket/mongo-$DATE --recursive
```

#### 3. AWS Snapshots

Create EBS volume snapshots:

- **Frequency**: Daily
- **Retention**: 7-30 days
- **Automation**: Use AWS Backup or Lambda

---

### Disaster Recovery

**Recovery Time Objective (RTO)**: ~30 minutes

**Recovery Point Objective (RPO)**: 24 hours (with daily backups)

**Recovery Steps**:

1. Launch new EC2 instance
2. Restore EBS snapshot or copy backup data
3. Install Docker and Docker Compose
4. Clone repository
5. Restore database volumes
6. Start containers

---

## Cost Optimization

### Estimated Monthly Costs

| Service         | Configuration   | Estimated Cost    |
| --------------- | --------------- | ----------------- |
| EC2 (t3.medium) | 730 hours/month | ~$30-35           |
| EBS Storage     | 30 GB           | ~$3               |
| Data Transfer   | 100 GB/month    | ~$9               |
| Gemini API      | Variable usage  | ~$10-50           |
| **Total**       |                 | **~$52-97/month** |

### Cost Reduction Tips

1. **Use Spot Instances**: Save up to 90% (not recommended for production)
2. **Reserved Instances**: Save up to 72% with 1-3 year commitment
3. **ARM-based Instances**: Use Graviton instances (t4g) for 20% savings
4. **Optimize Docker Images**: Smaller images = faster deployments
5. **Monitor API Usage**: Optimize Gemini API calls to reduce costs
6. **Use MongoDB Atlas Free Tier**: 512 MB free storage

---

## Security Best Practices

### 1. Network Security

- Use VPC with private subnets for databases
- Implement security groups with least privilege
- Enable VPC Flow Logs for network monitoring

### 2. Data Security

- Encrypt EBS volumes at rest
- Use SSL/TLS for data in transit
- Rotate JWT secrets regularly
- Never commit secrets to Git

### 3. Access Control

- Use IAM roles instead of access keys
- Enable MFA for AWS account
- Use AWS Systems Manager for secure SSH alternative
- Implement principle of least privilege

### 4. Application Security

- Keep Docker images updated
- Scan images for vulnerabilities
- Use environment variables for secrets
- Implement rate limiting (already configured)

### 5. Monitoring

- Enable CloudTrail for API logging
- Set up CloudWatch alarms
- Monitor Docker container health
- Regular security audits

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
docker compose logs server
docker compose ps
```

#### Database Connection Failed

```bash
docker exec -it mongo-db mongosh
docker exec -it qdrant-db curl http://localhost:6333/health
```

#### Out of Disk Space

```bash
docker system prune -a
df -h
```

#### High Memory Usage

```bash
docker stats
free -h
```

#### Port Already in Use

```bash
sudo lsof -i :3000
sudo netstat -tulpn | grep 3000
```

---

## Maintenance Tasks

### Weekly

- Review application logs
- Check disk usage
- Monitor container health

### Monthly

- Update Docker images
- Review security group rules
- Analyze cost reports
- Test backup restoration

### Quarterly

- Update EC2 instance OS
- Review and rotate secrets
- Performance optimization
- Security audit

---

## Migration Paths

### To Kubernetes

For larger deployments, consider migrating to:

- **Amazon EKS** (Elastic Kubernetes Service)
- **Self-managed Kubernetes**

**Benefits**:

- Better orchestration
- Auto-scaling
- Rolling updates
- Service mesh

### To Serverless

For variable workloads:

- **AWS Lambda** for API endpoints
- **Amazon ECS Fargate** for containers
- **AWS App Runner** for simplified deployment

**Benefits**:

- Pay only for usage
- No server management
- Automatic scaling

---

## Support Resources

### AWS Documentation

- [EC2 User Guide](https://docs.aws.amazon.com/ec2/)
- [Docker on AWS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/docker-basics.html)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)

### Monitoring Tools

- AWS CloudWatch
- Docker stats
- System logs (`/var/log/`)

### Community

- AWS Forums
- Docker Community
- Stack Overflow

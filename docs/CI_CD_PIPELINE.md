# CI/CD Pipeline Documentation

## Overview

This project uses **GitHub Actions** for continuous integration and continuous deployment (CI/CD). The pipeline automatically deploys the application to an AWS EC2 instance whenever code is pushed to the `main` branch.

---

## Pipeline Configuration

### Workflow File Location

```
.github/workflows/deploy.yml
```

### Trigger

The deployment workflow is triggered on:

- **Push events** to the `main` branch

```yaml
on:
  push:
    branches: ['main']
```

---

## Deployment Process

### Workflow Steps

#### 1. Checkout Repository

```yaml
- name: Checkout repo
  uses: actions/checkout@v3
```

**Purpose**: Fetches the latest code from the repository.

**Action Used**: `actions/checkout@v3`

---

#### 2. Deploy to EC2 via SSH

```yaml
- name: Deploy to EC2 via SSH
  uses: appleboy/ssh-action@v1.0.0
```

**Purpose**: Connects to the EC2 instance via SSH and executes deployment commands.

**Action Used**: `appleboy/ssh-action@v1.0.0`

**SSH Configuration**:

- **Host**: Retrieved from GitHub Secrets (`EC2_HOST`)
- **Username**: Retrieved from GitHub Secrets (`EC2_USER`)
- **SSH Key**: Retrieved from GitHub Secrets (`EC2_SSH_KEY`)

---

### Deployment Script

The following commands are executed on the EC2 instance:

#### Step 1: Navigate to Project Directory

```bash
cd ~/ai-chat-node-server
```

#### Step 2: Pull Latest Code

```bash
echo "Pulling latest code..."
git pull origin main
```

Fetches the latest changes from the `main` branch.

#### Step 3: Stop Existing Containers

```bash
echo "Stopping existing containers..."
docker compose down
```

Stops and removes all running containers defined in `docker-compose.yml`.

#### Step 4: Rebuild Docker Images

```bash
echo "Rebuilding images without cache..."
docker compose build --no-cache
```

Rebuilds all Docker images from scratch without using cached layers. This ensures all changes are included.

#### Step 5: Start Containers

```bash
echo "Starting containers..."
docker compose up -d
```

Starts all containers in detached mode (background).

#### Step 6: Deployment Complete

```bash
echo "Deployment complete!"
```

---

## GitHub Secrets Configuration

The following secrets must be configured in your GitHub repository:

### Required Secrets

| Secret Name   | Description                         | Example Value                             |
| ------------- | ----------------------------------- | ----------------------------------------- |
| `EC2_HOST`    | Public IP or domain of EC2 instance | `ec2-xx-xxx-xxx-xx.compute.amazonaws.com` |
| `EC2_USER`    | SSH username for EC2                | `ubuntu` or `ec2-user`                    |
| `EC2_SSH_KEY` | Private SSH key for authentication  | Contents of `.pem` file                   |

### How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the appropriate name and value

---

## Deployment Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Developer pushes code to main branch                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions workflow triggered                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Checkout latest code from repository                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Connect to EC2 instance via SSH                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Pull latest code on EC2                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Stop existing Docker containers                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Rebuild Docker images (no cache)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Start new Docker containers                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Deployment complete ✓                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Docker Compose Services

The deployment uses Docker Compose to orchestrate multiple services:

### Services Deployed

1. **server** - Node.js application server
2. **mongo** - MongoDB database
3. **qdrant** - Vector database for semantic search

All services are automatically started when `docker compose up -d` is executed.

---

## Deployment Best Practices

### Zero-Downtime Deployment

The current pipeline has a brief downtime during container restart. For zero-downtime deployments, consider:

- Using a load balancer
- Implementing blue-green deployment
- Using Docker Swarm or Kubernetes

### Rollback Strategy

If a deployment fails:

1. SSH into the EC2 instance
2. Navigate to the project directory
3. Checkout the previous working commit:
   ```bash
   git checkout <previous-commit-hash>
   ```
4. Rebuild and restart containers:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

### Health Checks

After deployment, verify the application is running:

```bash
curl http://your-domain.com/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "status": "ok"
  }
}
```

---

## Monitoring Deployment

### View Workflow Runs

1. Go to your GitHub repository
2. Click on the **Actions** tab
3. Select the **Deploy to EC2** workflow
4. View individual run details, logs, and status

### Deployment Logs

GitHub Actions provides detailed logs for each step:

- Checkout logs
- SSH connection logs
- Deployment script output
- Error messages (if any)

---

## Troubleshooting

### Common Issues

#### SSH Connection Failed

**Cause**: Invalid SSH credentials or EC2 instance not accessible

**Solution**:

- Verify `EC2_HOST`, `EC2_USER`, and `EC2_SSH_KEY` secrets
- Ensure EC2 security group allows SSH (port 22) from GitHub Actions IPs
- Check if SSH key has correct permissions

#### Docker Build Failed

**Cause**: Build errors in Dockerfile or missing dependencies

**Solution**:

- Review build logs in GitHub Actions
- Test Docker build locally
- Ensure all required files are committed

#### Container Start Failed

**Cause**: Environment variables missing or service conflicts

**Solution**:

- Verify `.env` file exists on EC2
- Check Docker logs: `docker compose logs`
- Ensure ports are not already in use

#### Git Pull Failed

**Cause**: Merge conflicts or authentication issues

**Solution**:

- SSH into EC2 and resolve conflicts manually
- Ensure EC2 has access to the GitHub repository
- Check if the repository URL is correct

---

## Security Considerations

### SSH Key Management

- Never commit SSH private keys to the repository
- Use GitHub Secrets for sensitive data
- Rotate SSH keys periodically
- Use dedicated deployment keys with minimal permissions

### EC2 Security Group

Configure inbound rules:

- **SSH (22)**: Restricted to specific IPs (GitHub Actions, your IP)
- **HTTP (80)**: Open to public (if using HTTP)
- **HTTPS (443)**: Open to public (if using HTTPS)
- **Application Port (3000)**: Restricted or behind reverse proxy

### Environment Variables

- Store sensitive data in `.env` file on EC2
- Never commit `.env` to repository
- Use `.env.example` as a template

---

## Performance Optimization

### Build Cache

The pipeline uses `--no-cache` to ensure clean builds. For faster builds:

- Remove `--no-cache` flag (trade-off: may use stale layers)
- Use multi-stage Docker builds
- Optimize Dockerfile layer ordering

### Parallel Execution

Currently, deployment is sequential. For faster deployments:

- Use Docker BuildKit
- Parallelize independent steps
- Pre-build images in CI

---

## Future Improvements

### Recommended Enhancements

1. **Automated Testing**: Add test stage before deployment
2. **Environment Staging**: Deploy to staging environment first
3. **Notifications**: Send Slack/email notifications on deployment status
4. **Database Migrations**: Automate database schema updates
5. **Health Check Verification**: Verify application health post-deployment
6. **Rollback Automation**: Automatic rollback on failed health checks

### Example Enhanced Workflow

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run tests
        run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to EC2
        # ... existing deployment steps

      - name: Health check
        run: curl -f http://your-domain.com/api/v1/health

      - name: Notify on success
        if: success()
        # Send success notification

      - name: Rollback on failure
        if: failure()
        # Execute rollback script
```

---

## Workflow Execution Time

Typical deployment duration:

- **Checkout**: ~5 seconds
- **SSH Connection**: ~2 seconds
- **Git Pull**: ~5 seconds
- **Docker Down**: ~10 seconds
- **Docker Build**: ~2-5 minutes (depending on changes)
- **Docker Up**: ~30 seconds

**Total**: ~3-6 minutes per deployment

---

## Support and Maintenance

### Logs Location on EC2

```bash
cd ~/ai-chat-node-server
docker compose logs -f
```

### Restart Services Manually

```bash
cd ~/ai-chat-node-server
docker compose restart
```

### View Running Containers

```bash
docker ps
```

### Check Disk Space

```bash
df -h
docker system df
```

### Clean Up Old Images

```bash
docker system prune -a
```

# Unified Ledger - Coolify Deployment Guide

Complete guide for deploying Unified Ledger using Coolify, a self-hosted deployment platform.

**Table of Contents**
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Deployment Process](#deployment-process)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Monitoring & Health Checks](#monitoring--health-checks)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **Server:** Linux-based (Ubuntu 20.04+, Debian 11+, or similar)
- **Memory:** Minimum 2GB RAM (4GB+ recommended)
- **Storage:** Minimum 10GB free space
- **CPU:** 2 cores (4+ cores recommended)
- **Docker:** Docker and Docker Compose installed

### Coolify Requirements
- Coolify server installed and running on your host
- Admin access to Coolify dashboard
- Domain name configured (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

### Application Requirements
- Clerk authentication account and API keys
- GitHub repository (optional, for automatic deployments)
- SMTP credentials (optional, for email notifications)

---

## Quick Start

### 1. Prepare Repository

Ensure your repository contains these files (already included):
```
Dockerfile                 # Multi-stage build configuration
docker-compose.yml        # Development/production compose setup
.dockerignore             # Docker build optimization
next.config.ts            # Standalone output enabled
```

### 2. Create Coolify Application

1. Open Coolify dashboard
2. Click "New" → "Application"
3. Select "Docker Compose" or connect GitHub repository
4. Configure basic settings:
   - **Name:** Unified Ledger
   - **Description:** Personal finance application
   - **Port:** 3000
   - **Build Command:** `pnpm build`
   - **Start Command:** `node server.js`

### 3. Set Environment Variables

Add these in Coolify environment configuration:

```bash
# Node Environment
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
HOSTNAME=0.0.0.0

# Database
DATABASE_URL=file:/app/data/finance.db

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key_here
CLERK_SECRET_KEY=your_secret_here
```

### 4. Configure Volumes

1. Create persistent volume for database:
   - **Volume Name:** `finance-data`
   - **Mount Path:** `/app/data`
   - **Type:** Named Volume

2. This ensures database persists across container restarts

### 5. Deploy

1. Click "Deploy" in Coolify
2. Monitor build progress in logs
3. Wait for health check to pass
4. Access application at your configured domain

---

## Configuration

### Coolify Application Settings

**Build Settings:**
```yaml
Build Context: .
Dockerfile Path: ./Dockerfile
Build Command: pnpm build
Install Command: pnpm install --frozen-lockfile
Start Command: node server.js
```

**Container Settings:**
```yaml
Port: 3000
CPU Limit: 1000m
Memory Limit: 1024Mi (2048Mi recommended)
Restart Policy: unless-stopped
Health Check: Enabled
Health Check Path: /api/health
Health Check Interval: 30s
Health Check Timeout: 10s
```

**Deployment Strategy:**
- Use rolling updates for zero downtime
- Enable auto-scaling if using multiple replicas
- Configure health checks before traffic routing

### Docker Compose for Production

For manual Coolify deployments using Docker Compose:

```yaml
version: '3.8'
services:
  finance-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: file:/app/data/finance.db
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${CLERK_PUBLISHABLE}
      CLERK_SECRET_KEY: ${CLERK_SECRET}
    volumes:
      - finance-data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - finance-network

volumes:
  finance-data:
    driver: local

networks:
  finance-network:
    driver: bridge
```

---

## Deployment Process

### Step-by-Step Deployment

**1. Prepare Repository**
```bash
# Ensure all Docker files are present
ls -la Dockerfile docker-compose.yml .dockerignore next.config.ts
```

**2. Test Docker Build Locally**
```bash
# Build Docker image
docker build -t unified-ledger:latest .

# Test container startup
docker run -it -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/data/finance.db \
  -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... \
  -e CLERK_SECRET_KEY=sk_test_... \
  unified-ledger:latest
```

**3. Configure Coolify Application**
- Navigate to Coolify dashboard
- Create new application
- Connect GitHub repository or upload code
- Configure deployment settings

**4. Set Environment Variables**
- Add all required environment variables
- Verify sensitive values are not exposed in logs
- Use Coolify secrets management

**5. Configure Storage**
- Create persistent volume for `/app/data`
- Enable volume backups if available
- Document volume mount points

**6. Deploy Application**
- Review deployment configuration
- Click "Deploy"
- Monitor build logs for errors
- Verify health checks pass
- Test application endpoints

**7. Configure Domain & SSL**
- Add domain name (optional)
- Enable Let's Encrypt SSL
- Configure HTTPS redirects
- Test HTTPS connectivity

### Initial Database Setup

First deployment will run database migrations automatically:

```bash
# Migrations run automatically via container CMD
# If needed, manual migration:
docker exec finance-app-container pnpm db:push
```

---

## Environment Variables

### Required Variables

```bash
# Node Runtime
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
HOSTNAME=0.0.0.0

# Database
DATABASE_URL=file:/app/data/finance.db

# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
```

### Optional Variables

```bash
# Analytics & Monitoring
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id

# SMTP (Email Notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=noreply@your-domain.com

# Feature Flags
ENABLE_CRON_JOBS=true
ENABLE_NOTIFICATIONS=true

# Performance
NEXT_PUBLIC_LOG_LEVEL=info
```

### Generating Clerk Keys

1. Visit [Clerk Dashboard](https://dashboard.clerk.com)
2. Create new application or use existing
3. Navigate to "API Keys" section
4. Copy `Publishable Key` and `Secret Key`
5. Add to Coolify environment variables

### Securing Environment Variables

**Best Practices:**
- Use Coolify's built-in secrets management
- Never commit secrets to version control
- Use different keys for staging/production
- Rotate keys periodically
- Audit environment variable access

---

## Database Setup

### SQLite (Default)

**File-Based Storage:**
- Database file: `/app/data/finance.db`
- Automatic creation on first run
- Requires persistent volume mount
- Suitable for single-user/small deployment

**Backup Strategy:**
```bash
# Backup database file from container
docker cp finance-app-container:/app/data/finance.db ./backup/finance-$(date +%Y%m%d).db

# Restore from backup
docker cp ./backup/finance-20240101.db finance-app-container:/app/data/finance.db
```

### PostgreSQL (Optional - Production Scale)

For larger deployments, consider PostgreSQL:

```yaml
# Add to docker-compose.yml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: finance
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  volumes:
    - postgres-data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**Update Environment Variable:**
```bash
DATABASE_URL=postgresql://postgres:password@postgres:5432/finance
```

### Database Migrations

Migrations run automatically on container startup:

```bash
# Manual migration (if needed)
docker exec finance-app-container sh -c "pnpm db:push"

# View migration status
docker exec finance-app-container sh -c "pnpm db:status"
```

---

## SSL/TLS Configuration

### Using Let's Encrypt (Recommended)

1. **Add Domain in Coolify:**
   - Application Settings → Domains
   - Add your domain (e.g., finance.your-domain.com)

2. **Enable SSL Certificate:**
   - Coolify automatically provisions Let's Encrypt cert
   - Automatic renewal every 90 days
   - Free and automatic

3. **Verify SSL:**
   ```bash
   curl -I https://finance.your-domain.com
   # Should return HTTP/2 200
   ```

### Custom SSL Certificate

1. **Upload Certificate:**
   - Application Settings → SSL Certificate
   - Upload certificate (.crt) and key (.key)
   - Specify certificate chain if needed

2. **Format Certificate:**
   ```bash
   # Convert PEM to required format if needed
   openssl x509 -in cert.pem -text -noout
   ```

### Security Headers

Already configured in `next.config.ts`:

```typescript
// Security headers included:
// X-Frame-Options: DENY
// X-Content-Type-Options: nosniff
// Referrer-Policy: origin-when-cross-origin
// X-XSS-Protection: 1; mode=block
// Permissions-Policy: camera=(), microphone=()
```

---

## Monitoring & Health Checks

### Health Check Endpoint

Application includes dedicated health check endpoint:

```bash
# GET /api/health
curl https://finance.your-domain.com/api/health

# Response (Healthy):
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}

# Response (Unhealthy - 503):
{
  "status": "unhealthy",
  "error": "Database connection failed",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Configure in Coolify

**Health Check Settings:**
- Path: `/api/health`
- Interval: 30 seconds
- Timeout: 10 seconds
- Retries: 3
- Expected Status: 200

### Monitoring Metrics

**CPU Usage:**
- Typical: <5% at idle
- Spike: <20% during request processing
- Alert threshold: >80% sustained

**Memory Usage:**
- Base: ~150-200MB
- Per-user: ~50-100MB
- Alert threshold: >85% of limit

**Disk Usage:**
- Database growth: ~1-5MB per 1000 transactions
- Logs: Configure log rotation
- Alert threshold: >90% of volume

### Logging

**View Application Logs:**
```bash
# In Coolify dashboard: Application → Logs
# Or via CLI:
docker logs -f finance-app-container
```

**Log Levels:**
- Development: debug
- Production: info (configure via environment)

---

## Backup & Recovery

### Automated Backup Strategy

**Daily Database Backup:**
```bash
#!/bin/bash
# backup.sh - Run via cron job daily

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/finance-ledger
CONTAINER_NAME=finance-app-container

mkdir -p $BACKUP_DIR

# Backup SQLite database
docker cp $CONTAINER_NAME:/app/data/finance.db \
  $BACKUP_DIR/finance-$TIMESTAMP.db

# Compress backup
gzip $BACKUP_DIR/finance-$TIMESTAMP.db

# Keep last 30 days only
find $BACKUP_DIR -name "*.db.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/finance-$TIMESTAMP.db.gz"
```

**Cron Job Setup:**
```bash
# Add to crontab (daily at 2 AM)
0 2 * * * /scripts/backup.sh >> /var/log/finance-backup.log 2>&1
```

### Recovery Procedure

**From Backup:**
```bash
# 1. Stop application container
docker stop finance-app-container

# 2. Restore database from backup
gunzip -c /backups/finance-ledger/finance-20240101_020000.db.gz > \
  /path/to/volume/finance.db

# 3. Verify database integrity
sqlite3 /path/to/volume/finance.db "PRAGMA integrity_check;"

# 4. Restart application
docker start finance-app-container

# 5. Verify application is healthy
curl https://finance.your-domain.com/api/health
```

### Volume Snapshots

If using managed storage with snapshot capability:

1. Enable automatic snapshots in Coolify
2. Set snapshot frequency (daily recommended)
3. Test snapshot restoration monthly
4. Document snapshot management policy

---

## Troubleshooting

### Application Won't Start

**Check Logs:**
```bash
docker logs finance-app-container
```

**Common Issues:**

1. **Build fails:**
   - Verify pnpm is installed in base image
   - Check Node version compatibility (18+)
   - Ensure pnpm-lock.yaml is included

2. **Container exits:**
   - Check environment variables are set
   - Verify database directory permissions
   - Review health check configuration

### Database Connection Issues

**Test Database:**
```bash
docker exec finance-app-container sh -c \
  "sqlite3 /app/data/finance.db '.tables'"
```

**Fix Permission Issues:**
```bash
docker exec finance-app-container sh -c \
  "chown -R nextjs:nodejs /app/data && chmod 755 /app/data"
```

### Health Check Failing

**Test Health Endpoint:**
```bash
# From host or Coolify terminal
curl -v http://localhost:3000/api/health

# Expected: HTTP 200 with JSON response
```

**Debug Steps:**
1. Verify application is running: `docker ps`
2. Check port is accessible: `docker port container-name`
3. Review application logs for errors
4. Verify database connectivity

### Memory Issues

**Increase Memory Limit:**
1. In Coolify: Application → Settings
2. Increase Memory Limit (e.g., 1024Mi → 2048Mi)
3. Redeploy application
4. Monitor usage after changes

**Optimize Memory:**
- Enable compression in Next.js config
- Implement code splitting for routes
- Use dynamic imports for heavy components
- Monitor bundle size regularly

### Slow Performance

**Optimize Application:**
1. Enable compression: `next/font` for fonts
2. Use image optimization
3. Implement route caching strategies
4. Check database query performance
5. Review Lighthouse reports

**Optimize Infrastructure:**
1. Increase CPU allocation
2. Enable caching layer (Redis optional)
3. Configure CDN if available
4. Monitor network latency

### Domain & SSL Issues

**Domain Not Resolving:**
1. Verify DNS records point to Coolify server
2. Check DNS propagation (24-48 hours)
3. Restart application after domain changes

**SSL Certificate Expired:**
1. Let's Encrypt auto-renews
2. Check Coolify logs for renewal status
3. Manual renewal: `certbot renew`

---

## Advanced Configuration

### Auto-Scaling (If Available)

For high-traffic deployments:

1. **Horizontal Scaling:**
   - Set minimum replicas: 2
   - Set maximum replicas: 5
   - Enable load balancer

2. **Vertical Scaling:**
   - Monitor CPU/memory usage
   - Increase limits gradually
   - Test performance impact

### Custom Domain with Subdomain

```bash
# DNS Configuration
finance.your-domain.com    CNAME    coolify.your-domain.com
# or
finance.your-domain.com    A        YOUR_COOLIFY_SERVER_IP
```

### Environment-Specific Deployments

**Staging Environment:**
```bash
NODE_ENV=development
NEXT_PUBLIC_ANALYTICS_ID=staging-id
# Use staging Clerk keys
```

**Production Environment:**
```bash
NODE_ENV=production
NEXT_PUBLIC_ANALYTICS_ID=production-id
# Use production Clerk keys
```

---

## Support & Resources

### Documentation Links
- [Coolify Documentation](https://coolify.io/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Docker Documentation](https://docs.docker.com)
- [Clerk Auth Guide](https://clerk.com/docs)

### Getting Help

1. **Coolify Issues:** Check Coolify GitHub issues
2. **Application Issues:** Review application logs
3. **Database Issues:** Check database integrity
4. **SSL Issues:** Check certificate status

### Reporting Issues

When reporting issues, include:
- Application logs (last 100 lines)
- Health check response
- Environment variables (without secrets)
- Steps to reproduce
- Expected vs actual behavior

---

## Deployment Checklist

- [ ] Docker files present (Dockerfile, .dockerignore)
- [ ] next.config.ts configured for standalone output
- [ ] Environment variables set in Coolify
- [ ] Database volume created and mounted
- [ ] Health check endpoint verified
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificate installed
- [ ] Application builds successfully
- [ ] Container starts without errors
- [ ] Health checks pass consistently
- [ ] Application accessible via domain
- [ ] Database persists across restarts
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Security headers verified
- [ ] Performance acceptable

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-01 | Initial Coolify deployment guide |

---

**Last Updated:** 2024-01-01
**Maintained By:** Unified Ledger Team

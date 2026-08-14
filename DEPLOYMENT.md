# Digital Ocean Deployment Guide

## Prerequisites
- Digital Ocean account
- Domain name (optional but recommended)
- GitHub repository with your code

## Step 1: Create Digital Ocean Droplet

1. **Log in to Digital Ocean**: https://cloud.digitalocean.com
2. **Create a new Droplet**:
   - Click "Create" → "Droplets"
   - Choose **Ubuntu 22.04 LTS**
   - Choose plan: **Basic** ($12/month - 2GB RAM, 1 CPU)
   - Choose datacenter region: **Closest to your users**
   - Authentication: **SSH Key** (recommended) or **Password**
   - Hostname: `ligma-app`
   - Click **Create Droplet**

3. **Note your Droplet's IP address** (e.g., 123.45.67.89)

## Step 2: Connect to Your Droplet

```bash
# SSH into your droplet (replace with your IP)
ssh root@123.45.67.89
```

## Step 3: Install Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (web server)
apt install -y nginx

# Install Git
apt install -y git

# Verify installations
node --version  # Should show v20.x
npm --version
pm2 --version
nginx -v
```

## Step 4: Clone Your Repository

```bash
# Navigate to web directory
cd /var/www

# Clone your repository
git clone https://github.com/YOUR_USERNAME/LIGMA_Collaborative_CanvaPad.git
cd LIGMA_Collaborative_CanvaPad

# Or if you want to use a specific branch
git clone -b main https://github.com/YOUR_USERNAME/LIGMA_Collaborative_CanvaPad.git
```

## Step 5: Setup Backend

```bash
# Navigate to backend
cd /var/www/LIGMA_Collaborative_CanvaPad/backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Create .env file
nano .env
```

**Add these environment variables (replace with your actual values):**
```
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:YOUR_PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
JWT_SECRET=GENERATE_WITH_openssl_rand_base64_32
JWT_EXPIRES_IN=7d
GROQ_API_KEY=your_groq_api_key
PORT=4000
NODE_ENV=production
BACKEND_URL=http://YOUR_DROPLET_IP:4000
FRONTEND_URL=http://YOUR_DROPLET_IP:3000
PUBLIC_APP_URL=http://YOUR_DROPLET_IP:3000
ALLOWED_ORIGINS=http://YOUR_DROPLET_IP:3000
WS_URL=ws://YOUR_DROPLET_IP:4000/ws
YJS_WS_URL=ws://YOUR_DROPLET_IP:4000/yjs
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

Save and exit (Ctrl+X, Y, Enter)

```bash
# Create logs directory
mkdir -p logs

# Start backend with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command it outputs
```

## Step 6: Setup Frontend

```bash
# Navigate to frontend
cd /var/www/LIGMA_Collaborative_CanvaPad/frontend

# Install dependencies
npm install

# Create .env.local file
nano .env.local
```

**Add these environment variables:**
```bash
NEXT_PUBLIC_API_URL=http://YOUR_DROPLET_IP:4000
NEXT_PUBLIC_WS_URL=ws://YOUR_DROPLET_IP:4000
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://dpezlvyebkbchgqalpro.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZXpsdnllYmtiY2hncWFscHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTY5MzMsImV4cCI6MjA5Mjg3MjkzM30.creAFkN0-8s3oB3VL5RVFDuJm9FwEtJWLf-A_BJlYp8
```

```bash
# Build the frontend
npm run build

# Start frontend with PM2
pm2 start npm --name "ligma-frontend" -- start

# Save PM2 configuration
pm2 save
```

## Step 7: Configure Nginx

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/ligma
```

**Add this configuration:**
```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;  # Or use your IP: 123.45.67.89

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:4000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    location /yjs {
        proxy_pass http://localhost:4000/yjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # Or use your IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/ligma /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

## Step 8: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Check status
ufw status
```

## Step 9: Setup SSL (Optional but Recommended)

If you have a domain name:

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Certbot will automatically configure Nginx for HTTPS
```

## Step 10: Verify Deployment

1. **Check PM2 processes:**
```bash
pm2 list
pm2 logs
```

2. **Check Nginx:**
```bash
systemctl status nginx
```

3. **Test the application:**
   - Frontend: `http://YOUR_IP` or `https://yourdomain.com`
   - Backend API: `http://YOUR_IP:4000/health` or `https://api.yourdomain.com/health`

## Maintenance Commands

```bash
# View logs
pm2 logs ligma-backend
pm2 logs ligma-frontend

# Restart services
pm2 restart ligma-backend
pm2 restart ligma-frontend

# Update code
cd /var/www/LIGMA_Collaborative_CanvaPad
git pull
cd backend && npm install && pm2 restart ligma-backend
cd ../frontend && npm install && npm run build && pm2 restart ligma-frontend

# Monitor resources
pm2 monit
```

## Troubleshooting

### Backend not starting
```bash
cd /var/www/LIGMA_Collaborative_CanvaPad/backend
pm2 logs ligma-backend --lines 100
```

### Frontend not building
```bash
cd /var/www/LIGMA_Collaborative_CanvaPad/frontend
npm run build
# Check for errors
```

### Database connection issues
- Verify DATABASE_URL in backend/.env
- Check if Supabase allows connections from your droplet IP
- Test connection: `cd backend && node test-sharing-tables.js`

### WebSocket not connecting
- Check firewall: `ufw status`
- Verify Nginx WebSocket configuration
- Check backend logs: `pm2 logs ligma-backend`

## Security Recommendations

1. **Change default passwords**
2. **Use SSH keys instead of passwords**
3. **Enable automatic security updates:**
```bash
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```
4. **Setup monitoring** (optional):
```bash
pm2 install pm2-logrotate
```

## Cost Estimate

- **Droplet**: $12/month (2GB RAM)
- **Domain**: ~$12/year (optional)
- **Total**: ~$12-13/month

## Alternative: Use Digital Ocean App Platform

For easier deployment (but slightly more expensive):

1. Go to Digital Ocean → App Platform
2. Connect your GitHub repository
3. Configure:
   - **Backend**: Node.js, port 4000
   - **Frontend**: Next.js (auto-detected)
4. Add environment variables
5. Deploy!

Cost: ~$20-30/month but handles everything automatically.

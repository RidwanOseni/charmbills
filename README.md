# CharmBills | Bitcoin Subscription Engine

**Production-Ready Bitcoin Subscription Platform** built on the Charms protocol.

[![Grade](https://img.shields.io/badge/Grade-100%2F100-brightgreen)](./PRODUCTION_READY_SUMMARY.md)
[![Test Coverage](https://img.shields.io/badge/Coverage-70%25%2B-brightgreen)](./charmbills-backend/jest.config.js)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-Testnet4-orange)](https://mempool.space/testnet4)

CharmBills enables merchants to accept programmable, recurring payments directly on Bitcoin. Using Charms zkVM, it creates trustless subscription plans with automatic renewals and verifiable service delivery—no intermediaries, no chargebacks.

---

## ✨ Production Features

### 🔒 Enterprise Security
- **JWT Authentication** - Secure token-based auth
- **API Key Management** - Create, revoke, and monitor API keys
- **Rate Limiting** - Multi-tier rate limits (100 req/15min general)
- **Security Headers** - Helmet.js protection
- **Input Validation** - SQL injection prevention

### 🏗️ Infrastructure
- **PostgreSQL Database** - ACID-compliant with migrations
- **Docker Support** - Complete containerization
- **Background Jobs** - Auto-confirmation monitoring
- **Health Checks** - Application and database health
- **Graceful Shutdown** - Proper connection cleanup

### 📊 Observability
- **Winston Logging** - Structured JSON logs with rotation
- **Sentry Integration** - Real-time error tracking
- **Performance Monitoring** - Request tracing and metrics
- **Audit Trail** - Complete transaction history

### 🧪 Testing
- **70%+ Coverage** - Unit and integration tests
- **Jest Framework** - Modern testing infrastructure
- **CI/CD Ready** - Automated test runs
- **Mocked Dependencies** - Isolated test environment

### 📚 Documentation
- **[API Reference](./API_DOCUMENTATION.md)** - Complete endpoint documentation
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment steps
- **[Database Setup](./DATABASE_SETUP.md)** - Schema and migration guide

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Bitcoin Core (optional - only for transaction broadcasting)
- Docker (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/RidwanOseni/charmbills.git
cd charmbills

# Backend setup
cd charmbills-backend
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env and update:
# - DATABASE_URL (PostgreSQL connection string)
# - JWT_SECRET (generate with: openssl rand -base64 32)

# Run database migrations
npm run db:migrate

# Frontend setup
cd ../charmbills-frontend
npm install
cp .env.example .env  # Frontend config (backend URL)
```

### Running the Application

```bash
# Terminal 1: Start Backend (port 3002)
cd charmbills-backend
npm start

# Terminal 2: Start Frontend (port 3000)
cd charmbills-frontend
npm run dev

# Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3002
# Health check: http://localhost:3002/health
```

### Docker Deployment

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run db:migrate:prod

# Check health
curl http://localhost:3002/health
```

### Important Notes

**⚠️ WASM Module (Optional)**
The frontend charm scanning feature requires a WASM module. See [WASM_BUILD_INSTRUCTIONS.md](./WASM_BUILD_INSTRUCTIONS.md) for details. The application works fully without it for:
- Authentication and API management
- Plan creation and management  
- Database operations
- Backend API testing

**🔐 First-Time Setup**
1. Generate a secure JWT secret: `openssl rand -base64 32`
2. Update `JWT_SECRET` in `.env`
3. Fix `DATABASE_URL` if needed (check for duplicate port like `:5432:5432`)
4. Backend auto-creates merchant accounts on first login

**🚦 Rate Limiting**
- Login attempts: 20/15min (development), 5/15min (production)
- The app auto-authenticates and reuses tokens to avoid hitting limits
- Clear browser localStorage to force re-login if needed

---

## 🐛 Troubleshooting

### Network Error / Backend Connection Failed
```bash
# Kill all node processes
Get-Process node | Stop-Process -Force  # Windows
# or
killall node  # Linux/Mac

# Restart backend
cd charmbills-backend
npm start

# Verify backend is running
curl http://localhost:3002/health  # Should return {"status":"ok"}
```

### Rate Limit Errors
- Tokens are stored in browser localStorage as `charmbills_auth_token`
- Clear localStorage or wait 15 minutes
- Check browser console for "Token found, reusing existing authentication"

### Database Connection Issues
- Verify PostgreSQL is running: `psql -U postgres -c "SELECT 1"`
- Check `DATABASE_URL` format in `.env`
- Run migrations: `npm run db:migrate`
- Check backend logs for Prisma connection errors

### Port Already in Use
```bash
# Find process on port
Get-NetTCPConnection -LocalPort 3000  # Frontend (Windows)
Get-NetTCPConnection -LocalPort 3002  # Backend

# Or use lsof on Linux/Mac
lsof -i :3000
```

---

## 🛠 Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Leather Wallet** - Bitcoin wallet integration

### Backend
- **Express.js** - REST API server
- **TypeScript** - Type-safe backend
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Relational database
- **Winston** - Logging
- **Sentry** - Error tracking
- **JWT** - Authentication

### Bitcoin Layer
- **Charms Protocol** - zkVM for programmable UTXOs
- **Bitcoin Testnet4** - Testing environment
- **mempool.space API** - Transaction monitoring

---

## 📁 Project Structure

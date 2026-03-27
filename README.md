# Next Carbon - Backend

Express.js backend for the carbon credit tokenization platform. Handles API requests, payment processing, and blockchain interactions.

## Tech Stack

- **Express.js** + **TypeScript 5.7**
- **ethers.js v6** for blockchain interaction
- **Supabase** (PostgreSQL) for database
- **Razorpay SDK** for payment processing
- **Zod** for request validation
- **Multer** for file uploads

## Features

- RESTful API for all platform operations
- Blockchain integration via Company Wallet (custodial model)
- Payment verification with Razorpay webhooks
- Token minting, maturity, and offset operations
- Pool deposit/withdraw/claim management
- KYC document upload handling

## Environment Variables

Create a `.env` file:

```env
PORT=3001

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_SECRET=your-secret

# Supabase
SUPABASE_URI=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Blockchain (Polygon Amoy)
INFURA_API_URL=https://rpc-amoy.polygon.technology
PRIVATE_KEY=your-wallet-private-key
COMPANY_ADDRESS=0xYourCompanyWalletAddress

# Contract Addresses
CREDIT_MANAGER_ADDRESS=0x...
PROJECT_TOKEN_FACTORY_ADDRESS=0x...
CREDIT_POOL_ADDRESS=0x...
ACTUAL_CREDIT_ADDRESS=0x...
SEC_TOKEN_ADDRESS=0x...
RETIREMENT_CERTIFICATE_ADDRESS=0x...
```

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npx tsc
node dist/index.js
```

## Deployment Guide

### Option 1: Direct Node.js

1. Build TypeScript:
   ```bash
   npx tsc
   ```

2. Run with nohup:
   ```bash
   nohup node dist/index.js > /var/log/backend.log 2>&1 &
   ```

### Option 2: PM2 (Recommended)

1. Install PM2:
   ```bash
   npm install -g pm2
   ```

2. Build and start:
   ```bash
   npx tsc
   pm2 start dist/index.js --name "nextcarbon-backend"
   pm2 save
   pm2 startup
   ```

3. Monitor:
   ```bash
   pm2 logs nextcarbon-backend
   pm2 monit
   ```

### Option 3: Systemd Service

1. Create `/etc/systemd/system/nextcarbon-backend.service`:
   ```ini
   [Unit]
   Description=Next Carbon Backend
   After=network.target

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/home/ubuntu/Next_Carbon_backend
   ExecStart=/usr/bin/node dist/index.js
   Restart=on-failure
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start:
   ```bash
   sudo systemctl enable nextcarbon-backend
   sudo systemctl start nextcarbon-backend
   ```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/property` | List all carbon projects |
| POST | `/api/property` | Create new project (admin) |
| POST | `/api/orders/create` | Create Razorpay order |
| POST | `/api/orders/verify` | Verify payment & mint tokens |
| GET | `/api/tokens/balance/:userId` | Get user token balances |
| POST | `/api/tokens/redeem` | Redeem tokens to wallet |
| POST | `/api/pool/deposit` | Deposit PT to pool |
| POST | `/api/pool/withdraw` | Withdraw from pool |
| POST | `/api/pool/claim` | Claim VCC (FCFS) |
| POST | `/api/admin/mature` | Trigger partial maturity |
| POST | `/api/offset/create` | Offset VCC + mint NFT |
| GET | `/api/offset/certificates/:userId` | Get user's NFT certificates |

## Project Structure

```
src/
├── controllers/      # Route handlers
├── routes/           # Express routers
├── schemas/          # Zod validation schemas
├── lib/
│   ├── config.ts     # Environment config
│   ├── ethers.ts     # Blockchain functions
│   └── supabase.ts   # Supabase client
└── index.ts          # App entry point
```

## License

MIT

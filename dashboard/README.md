# Agent Vault Dashboard

Professional dashboard for managing verifiable credentials and agent reputation on Midnight blockchain.

## Features

- **Wallet Connection**: Connect with browser-based Midnight wallet
- **Credential Issuance**: Issue verifiable credentials to AI agents
- **Reputation Tracking**: Monitor agent performance and authorization history
- **Real-Time Stats**: View blockchain statistics and activity feed
- **Agent Management**: Create and manage multiple agents with unique credentials

## Tech Stack

- **Framework**: Next.js 16 with Turbopack
- **Styling**: Tailwind CSS + shadcn/ui
- **Blockchain**: Midnight Network (TestNet-02)
- **Database**: Neon PostgreSQL (serverless)
- **Design**: Linear-inspired minimalist UI

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

Create `.env.local`:

```env
# Neon Database
POSTGRES_URL=postgresql://...

# Midnight Network
MIDNIGHT_RPC_URL=https://rpc.testnet.midnight.network
MIDNIGHT_PROOF_SERVER_URL=http://localhost:6300
```

## Project Structure

```
dashboard/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── agents/               # Agent management pages
│   └── api/                  # API routes
├── components/
│   ├── ui/                   # shadcn components
│   ├── landing-page.tsx      # Landing page
│   └── wallet-button.tsx     # Wallet connection
└── lib/
    ├── wallet-context.tsx    # Wallet state management
    └── utils.ts              # Utilities
```

## Key Pages

- **Landing Page** (`/`): Hero section with wallet connection
- **Dashboard** (`/` when connected): Stats and activity feed
- **Agent Management** (`/agents`): Create and manage agents
- **Agent Details** (`/agents/[id]`): View individual agent credentials and reputation

## Design Philosophy

Clean, minimal, professional design inspired by Linear and Vercel. Focus on:
- Typography and white space
- Subtle borders and shadows
- Consistent color palette (gray scale + accent colors)
- No unnecessary animations or effects
- Clear information hierarchy

## API Routes

- `GET /api/stats/wallet?address={wallet}` - Wallet-specific statistics
- `GET /api/activity/wallet?address={wallet}` - Recent activity feed
- `GET /api/contract-status` - Contract deployment status
- `GET /api/midnight-stats` - Blockchain statistics

## Development

```bash
# Install dependencies
npm install

# Run development server (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

Dashboard is deployed on Vercel. For deployment:

1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main

## Learn More

- [Agent Vault Documentation](../README.md)
- [Midnight Network](https://midnight.network)
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com)

# Code Standards & Development Guidelines

**Last Updated**: 2026-03-26
**Version**: 1.0.0
**Project**: Crypto Rebalance Bot
**Applies To**: All TypeScript/JavaScript code

## Overview

Development standards, file organization, naming conventions, and best practices for the Crypto Rebalance Bot. All code must adhere to these standards for consistency, type safety, and maintainability.

## Core Development Principles

### YAGNI (You Aren't Gonna Need It)
- Implement only features that are currently needed
- Avoid over-engineering for hypothetical future requirements
- Start simple, refactor when necessary

### KISS (Keep It Simple, Stupid)
- Prefer straightforward, readable solutions
- Avoid unnecessary complexity and clever tricks
- Prioritize clarity over performance optimizations

### DRY (Don't Repeat Yourself)
- Eliminate code duplication
- Extract common logic into reusable functions
- Use composition over repetition

## Runtime & Language

**Runtime**: Bun 1.2+
- Use `bun run src/index.ts` for development
- Use `bun build` for production builds
- Use `bun test` for testing

**Language**: TypeScript 5.7+ (Strict Mode)
- Enforce `"strict": true` in tsconfig.json
- No `any` types (use `unknown` with type guards)
- Strict null checks enabled
- Full type coverage required

## File Organization

### Directory Structure

```
src/
├── index.ts              # Application entry point
├── config/               # Configuration management
├── db/
│   ├── models/           # 14 Mongoose schema definitions
│   ├── connection.ts     # MongoDB connection (Mongoose)
│   ├── database.ts       # Database initialization
│   └── test-helpers.ts   # setupTestDB / teardownTestDB
├── exchange/             # Exchange connectivity (CCXT Pro)
├── price/                # Market data processing
├── portfolio/            # Portfolio state management
├── rebalancer/           # Rebalancing logic
├── executor/             # Order execution
├── api/
│   ├── routes.ts         # Route definitions
│   └── ws.ts             # WebSocket handlers
├── events/               # Event bus
├── notifier/             # Telegram notifications
├── scheduler/            # Cron tasks
├── trailing-stop/        # Trailing-stop strategy
├── dca/                  # Dollar-cost averaging
├── twap-vwap/            # TWAP/VWAP order splitting
├── grid/                 # Grid trading
├── backtesting/          # Backtesting framework
├── analytics/            # Performance metrics
├── ai/                   # ML suggestions
└── copy-trading/         # Copy trading
```

### File Naming

**TypeScript Files**:
- Use kebab-case: `user-service.ts`, `portfolio-manager.ts`
- Descriptive names that indicate purpose
- Test files: `*.test.ts` or `*.spec.ts`

**Classes/Types**:
- Use PascalCase: `UserService`, `PortfolioManager`
- Export as default when single export

**Functions**:
- Use camelCase: `fetchPortfolio()`, `calculateAllocation()`
- Descriptive names indicating action and object

**Constants**:
- Use UPPER_SNAKE_CASE: `MAX_RETRY_COUNT`, `DEFAULT_THRESHOLD`
- Group related constants together

## Naming Conventions

### Variables & Constants

```typescript
// Variables - camelCase
const portfolioValue = 50000;
const isRebalancing = false;
const userPreferences = { ... };

// Constants - UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_THRESHOLD = 0.05;
const API_BASE_URL = 'https://api.example.com';

// Private members - underscore prefix
class Database {
  private _connectionPool: Pool;
  private _initialized = false;
}
```

### Functions & Methods

```typescript
// Regular functions - camelCase
function calculateAllocation(holdings: Holdings): Allocation { }

// Arrow functions
const fetchPortfolio = async (exchange: string): Promise<Portfolio> => { };

// Boolean functions - is/has/can prefix
function isRebalanceNeeded(current: Allocation, target: Allocation): boolean { }
function hasValidCredentials(exchange: string): boolean { }
function canExecuteTrade(amount: number): boolean { }
```

### Types & Interfaces

```typescript
// Use PascalCase
interface Portfolio {
  holdings: Record<string, number>;
  totalValueUsd: number;
}

type Allocation = Record<string, number>;

// Enums
enum OrderStatus {
  Pending = 'pending',
  Filled = 'filled',
  Failed = 'failed',
}
```

## Code Style Guidelines

### Formatting

**Indentation**: 2 spaces (enforced by Biome)
**Line Length**: 100 characters preferred, 120 character hard limit
**Quotes**: Double quotes (`"`) for strings
**Semicolons**: Always include

**Example**:
```typescript
const portfolio = await fetchPortfolio('binance');
const allocation = calculateAllocation(portfolio.holdings);
const trades = generateRebalancePlan(allocation, targets);
```

### Import Organization

```typescript
// 1. Bun built-ins
import { read, write } from 'bun:fs';

// 2. External dependencies
import { Router } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { EventEmitter } from 'events';

// 3. Internal modules (absolute paths)
import { logger } from './config/logger';
import { exchangeService } from './exchange';
import { eventBus } from './events';

// 4. Types (at end)
import type { Portfolio, Trade } from './types';
```

### Comments & Documentation

**File Headers** (Optional but recommended):
```typescript
/**
 * Portfolio Service
 *
 * Manages portfolio state: fetching holdings, calculating allocations,
 * detecting drift, and generating snapshots for analysis.
 *
 * @module services/portfolio
 */
```

**Function Documentation**:
```typescript
/**
 * Calculate allocation percentages from holdings
 *
 * @param holdings - Map of asset symbol to quantity
 * @returns Record of asset to allocation percentage
 * @throws Error if totalValue is zero
 */
export function calculateAllocation(
  holdings: Record<string, number>
): Allocation {
  // Implementation
}
```

**Inline Comments**:
- Explain WHY, not WHAT
- Use for non-obvious logic
- Keep brief and focused

```typescript
// Multiply by 1e8 to avoid floating-point precision issues
const satoshis = bitcoins * 1e8;

// Use exponential backoff to avoid rate limiting
const delay = Math.pow(2, retryCount) * 1000;
```

### Error Handling

**Always Use Try-Catch**:
```typescript
async function executeRebalance(trades: Trade[]): Promise<void> {
  try {
    const results = await Promise.all(
      trades.map(t => exchange.executeOrder(t))
    );
    logger.info('Rebalance completed', { count: results.length });
  } catch (error) {
    logger.error('Rebalance failed', {
      error: error instanceof Error ? error.message : String(error),
      trades: trades.length,
    });
    throw error;
  }
}
```

**Custom Error Types**:
```typescript
class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Usage
throw new ValidationError('Invalid allocation target', 'BTC');
```

### TypeScript Strict Mode

**No `any` Types**:
```typescript
// BAD
const portfolio: any = fetchPortfolio();

// GOOD
const portfolio: Portfolio = fetchPortfolio();

// If type is unknown
const data: unknown = JSON.parse(input);
if (typeof data === 'object' && data !== null) {
  // Safe to use
}
```

**Null Safety**:
```typescript
// Use optional chaining and nullish coalescing
const value = portfolio?.holdings?.BTC ?? 0;

// Type guards
if (result instanceof Error) {
  logger.error('Error occurred', { message: result.message });
}

// Non-null assertion only when certain
const portfolio = getPortfolio()!; // Know it's not null
```

## API & Database Design

### REST API (Hono)

**Route Naming**:
```typescript
// Use kebab-case in URLs
GET    /api/portfolio         // Get current portfolio
GET    /api/portfolio/:asset  // Get specific asset
POST   /api/rebalance         // Trigger rebalance
GET    /api/trades            // List trades
GET    /api/allocations       // Get targets

// Use camelCase in JSON fields
{
  "portfolioValue": 50000,
  "totalFeesPaid": 125.50,
  "isRebalancing": false,
  "lastRebalance": "2026-03-22T10:30:00Z"
}
```

**Request/Response**:
```typescript
// Use Zod for validation
const RebalanceRequest = z.object({
  assetPair: z.string(),
  amount: z.number().positive(),
  execute: z.boolean().optional(),
});

// Handler with type safety
app.post('/api/rebalance', async (c) => {
  const body = await c.req.json();
  const validated = RebalanceRequest.parse(body);
  // Process
  return c.json({ success: true });
});
```

### Database Schema

**Mongoose ODM with MongoDB**:
```typescript
import { Schema, model } from 'mongoose';

const tradeSchema = new Schema({
  exchange: { type: String, required: true, index: true },
  pair: { type: String, required: true },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  amount: { type: Number, required: true },
  price: { type: Number, required: true },
  executedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

// Compound index for range queries
tradeSchema.index({ exchange: 1, executedAt: -1 });

export const Trade = model('Trade', tradeSchema);
```

**Index Strategy**:
- Index frequently queried columns (exchange, pair, timestamps)
- Compound indexes for multi-field queries
- Use sparse indexes for optional fields
- Example: `{ exchange: 1, executedAt: -1 }` for date range queries per exchange

**Connection Pattern** (`src/db/connection.ts`):
```typescript
import mongoose from 'mongoose';

export async function connectToDatabase() {
  await mongoose.connect(process.env.MONGODB_URI);
}

export async function disconnectFromDatabase() {
  await mongoose.disconnect();
}
```

**Test Helpers** (`src/db/test-helpers.ts`):
```typescript
export async function setupTestDB() {
  await connectToDatabase();
  // Clear collections
}

export async function teardownTestDB() {
  await disconnectFromDatabase();
}
```

## Service Pattern

### Singleton Services

Each service has one instance per application:

```typescript
// exchange/index.ts
class ExchangeService {
  private static instance: ExchangeService;

  private constructor() {
    // Initialize
  }

  static getInstance(): ExchangeService {
    if (!this.instance) {
      this.instance = new ExchangeService();
    }
    return this.instance;
  }

  async fetchPortfolio(exchange: string): Promise<Portfolio> {
    // Implementation
  }
}

export const exchangeService = ExchangeService.getInstance();
```

### Dependency Injection

```typescript
// Services receive dependencies via constructor or methods
class RebalancerService {
  constructor(
    private portfolio: PortfolioService,
    private exchange: ExchangeService,
    private eventBus: EventEmitter
  ) {}

  async rebalance(targets: Allocation): Promise<void> {
    const current = await this.portfolio.getCurrentAllocation();
    const trades = this.calculateTrades(current, targets);

    this.eventBus.emit('rebalance:triggered', { trades });
    // Execute
  }
}
```

## Event-Driven Architecture

### EventBus Pattern

```typescript
// Emit events with typed data
eventBus.emit('price:update', {
  exchange: 'binance',
  pair: 'BTC/USD',
  price: 65000,
  timestamp: Date.now(),
});

// Listen to events
eventBus.on('trade:executed', ({ orderId, amount, fee }) => {
  logger.info('Trade completed', { orderId, amount, fee });
});
```

**Key Events**:
- `price:update` → New market data
- `portfolio:snapshot` → State captured
- `rebalance:triggered` → Rebalance initiated
- `trade:executed` → Order filled
- `strategy:signal` → Buy/sell signal
- `alert:threshold` → Alert triggered

## Testing

### Test File Organization

```
tests/
├── unit/
│   ├── portfolio-service.test.ts
│   └── rebalancer-service.test.ts
├── integration/
│   └── api.test.ts
└── fixtures/
    └── mock-data.ts
```

### Testing Patterns

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('PortfolioService', () => {
  let service: PortfolioService;

  beforeEach(() => {
    service = new PortfolioService();
  });

  it('should calculate allocation correctly', () => {
    const holdings = { BTC: 1, ETH: 10, USDC: 50000 };
    const allocation = service.calculateAllocation(holdings);

    expect(allocation.BTC).toBeCloseTo(0.02, 2);
  });

  it('should throw on empty holdings', () => {
    expect(() => {
      service.calculateAllocation({});
    }).toThrow();
  });
});
```

### Test Coverage
- Unit tests: >80% code coverage
- Integration tests: Critical paths
- Error scenarios: All error handling tested
- Edge cases: Boundary conditions

## Security Standards

### Credential Handling

**Never Log Credentials**:
```typescript
// BAD
logger.info('API key:', { apiKey });

// GOOD
logger.info('Authentication successful', { exchange });

// Encrypt at rest
const encrypted = encrypt(apiKey, encryptionKey);
await db.insert(exchangeConfigs).values({
  apiKeyEnc: encrypted,
});
```

### Input Validation

```typescript
import { z } from 'zod';

const AllocationSchema = z.record(
  z.string().min(1),
  z.number().min(0).max(100)
);

function setAllocations(targets: unknown): void {
  const validated = AllocationSchema.parse(targets);
  // Safe to use
}
```

### SQL Injection Prevention

```typescript
// Use Drizzle ORM parameterized queries
const trade = await db
  .select()
  .from(trades)
  .where(eq(trades.orderId, orderId))
  .limit(1);

// Never concatenate user input
// BAD: `SELECT * FROM trades WHERE orderId = '${orderId}'`
```

## Git Standards

### Commit Messages

**Format**: Conventional Commits
```
type(scope): description

[optional body]

[optional footer]
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `test` - Test additions/changes
- `docs` - Documentation updates
- `ci` - CI/CD changes
- `chore` - Maintenance tasks

**Examples**:
```
feat(rebalancer): add momentum-tilt strategy

Implements momentum-based weighting that tilts allocation
toward higher-momentum assets. Configurable via TARGET_MOMENTUM_WEIGHT.

Closes #42

---

fix(executor): handle partial order fills correctly

Track filled quantity separately from request amount to properly
update holdings after partial fills.
```

### Pre-Commit Checklist

- ✅ No secrets or credentials
- ✅ TypeScript compiles without errors
- ✅ Biome linting passes
- ✅ Unit tests pass
- ✅ No hardcoded values (use config)
- ✅ Type coverage complete
- ✅ Error handling present
- ✅ Updated relevant docs

## Linting & Formatting

### Biome Configuration

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "style": {
        "noImplicitAny": "error",
        "noVar": "error"
      }
    }
  },
  "formatter": {
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

**Run Checks**:
```bash
biome check .              # Check all files
biome check --fix .        # Auto-fix issues
```

## Documentation Standards

### Code Comments

**When to Comment**:
- Complex algorithms or business logic
- Non-obvious optimizations
- Workarounds for bugs or limitations
- Financial calculation details

**When NOT to Comment**:
- Self-evident code
- Variable/function naming is clear
- Code that's straightforward to read

### Markdown Documentation

**Structure**:
- Clear headings with hierarchy
- Code blocks with language specification
- Tables for structured data
- Lists for sequential items
- Links for cross-references

**Example**:
```markdown
## Configuration

Set these environment variables:

| Variable | Required | Default |
|----------|----------|---------|
| EXCHANGE_API_KEY | Yes | - |
| REBALANCE_THRESHOLD | No | 0.05 |

### Example Setup

```bash
export EXCHANGE_API_KEY="your-key-here"
export REBALANCE_THRESHOLD="0.10"
```
```

## Performance Considerations

### Optimization Priorities

1. **Correctness First** - Results must be accurate
2. **Readability Second** - Code must be maintainable
3. **Performance Third** - Only optimize if needed

### Common Patterns

**Async Operations**:
```typescript
// Use Promise.all() for parallel operations
const [portfolio, prices, allocations] = await Promise.all([
  fetchPortfolio(),
  fetchPrices(),
  fetchAllocations(),
]);
```

**Caching**:
```typescript
// Cache expensive computations
const memoizedCalculation = (() => {
  let cached: number | null = null;
  return () => {
    if (cached === null) {
      cached = expensiveComputation();
    }
    return cached;
  };
})();
```

## Module Boundaries

### What Goes Where

| Module | Responsibility |
|--------|-----------------|
| `exchange/` | CCXT Pro integration, order execution |
| `price/` | Market data aggregation, technical indicators |
| `portfolio/` | Holdings tracking, allocation calculation |
| `rebalancer/` | Strategy logic, trade planning |
| `executor/` | Order submission, trade recording |
| `api/` | HTTP routes, WebSocket handlers |
| `db/` | Schema, migrations, persistence |
| `events/` | Event emission, event coordination |
| `notifier/` | Telegram alerts, messages |
| `scheduler/` | Cron tasks, scheduled execution |

## Configuration Management

### Environment Variables

```typescript
// src/config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  MONGODB_URI: z.string().default(
    'mongodb://admin:password@mongodb:27017/rebalance?authSource=admin'
  ),
  MONGO_PASSWORD: z.string(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  REBALANCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.05),
  MIN_TRADE_USD: z.coerce.number().default(10),
  PAPER_TRADING: z.enum(['true', 'false']).default('true'),
  VITE_API_URL: z.string().default('/api'),
});

export const config = EnvSchema.parse(process.env);
```

**Docker Compose Auto-Sets**:
- `MONGODB_URI` - Constructed from `MONGO_PASSWORD`
- `VITE_API_URL=/api` - For frontend build

### Secrets Management

```typescript
// Never commit .env files
// Use .env.example as template
// Encrypt credentials in database
// Decrypt only for API calls
```

## References

### Internal Documentation
- [System Architecture](./system-architecture.md)
- [Project Overview](./project-overview-pdr.md)
- [Codebase Summary](./codebase-summary.md)

### External Standards
- [Conventional Commits](https://conventionalcommits.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Hono Documentation](https://hono.dev/)

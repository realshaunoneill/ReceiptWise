# Database Setup

This directory contains the database schema, migrations, and connection utilities for the Receipt & Spending Tracker application.

## Setup

1. **Configure Database Connection**
   
   Copy `.env.example` to `.env` and set your PostgreSQL connection string:
   ```bash
   cp .env.example .env
   ```
   
   Update the `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/receipt_tracker
   ```

2. **Generate Migrations**
   
   After modifying the schema in `schema.ts`, generate migration files:
   ```bash
   npm run db:generate
   ```

3. **Run Migrations**
   
   Apply pending migrations to your database:
   ```bash
   npm run db:migrate
   ```

4. **Push Schema (Development)**
   
   For rapid development, you can push schema changes directly without migrations:
   ```bash
   npm run db:push
   ```
   
   ⚠️ **Warning**: This should only be used in development as it doesn't create migration files.

5. **Drizzle Studio**
   
   Launch the Drizzle Studio GUI to browse and edit your database:
   ```bash
   npm run db:studio
   ```

## Files

- **schema.ts**: Database schema definitions using Drizzle ORM
- **index.ts**: Database connection utility with singleton pattern
- **migrate.ts**: Migration runner script
- **migrations/**: Generated SQL migration files

## Schema Overview

### Tables

- **users**: User accounts, linked to their Better Auth identity (`auth_user`) by `auth_user_id`
- **households**: Shared spaces for financial collaboration
- **household_users**: Junction table for household membership
- **bank_connections**: Bank account integrations

### Relationships

- Users can belong to multiple households
- Households have multiple users with roles (owner/member)
- Bank connections belong to users
- Cascade deletes ensure data integrity

## Usage in Application

Import the database client in your code:

```typescript
import { db } from '@/lib/db';
import { users, households } from '@/lib/db/schema';

// Query example
const allUsers = await db.select().from(users);

// Insert example
await db.insert(users).values({
  email: 'user@example.com',
});
```

## Type Safety

All database operations are fully type-safe thanks to Drizzle ORM. TypeScript types are automatically inferred from the schema definitions.

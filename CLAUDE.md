# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chatbot UI is an open-source AI chat application that supports multiple LLM providers (OpenAI, Anthropic, Google, Mistral, Groq, Perplexity, OpenRouter, Azure, and local Ollama models). Built with Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, and Supabase for backend/auth/storage.

## Development Commands

### Local Development
```bash
# Start Supabase and run dev server
npm run chat

# Just run Next.js dev server (requires Supabase already running)
npm run dev

# Restart Supabase and dev server
npm run restart
```

### Database Management
```bash
# Reset local database and regenerate types
npm run db-reset

# Apply migrations and regenerate types
npm run db-migrate

# Generate TypeScript types from Supabase schema
npm run db-types

# Push local migrations to remote database
npm run db-push

# Pull remote changes to local
npm run db-pull
```

### Updates
```bash
# Update from main branch, apply migrations, and regenerate types
npm run update
```

### Code Quality
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format:check
npm run format:write

# Clean (lint fix + format)
npm run clean
```

### Build & Deploy
```bash
# Production build
npm run build

# Preview production build
npm run preview

# Analyze bundle size
npm run analyze
```

### Testing
```bash
npm run test
```

## Architecture

### State Management
- **Global Context**: `context/context.tsx` defines `ChatbotUIContext` with all application state
- State is organized into logical stores: Profile, Items, Models, Workspace, Assistant, Chat (passive/active), Attachments, Retrieval, Tools
- React Context + useState for state management (no Redux/Zustand)

### Database Layer (`/db`)
- Each database table has a corresponding TypeScript module (e.g., `db/chats.ts`, `db/messages.ts`)
- All database operations use Supabase client
- Types are auto-generated in `supabase/types.ts` via `npm run db-types`
- Storage operations in `db/storage/` for handling file uploads (assistants, files, messages, profiles, workspaces)

### API Routes (`/app/api`)
- **Chat routes** (`/app/api/chat/[provider]/route.ts`): Each LLM provider has its own API route
  - `openai`, `anthropic`, `google`, `mistral`, `groq`, `perplexity`, `openrouter`, `azure`, `custom`
  - `tools/route.ts`: Handles tool/function calling
- **Retrieval**: `/app/api/retrieval/process` and `/app/api/retrieval/retrieve` for RAG functionality
- All routes use Next.js 14 Route Handlers (not Pages API)

### LLM Integration (`/lib/models/llm`)
- `llm-list.ts`: Aggregates all available models
- Provider-specific lists: `openai-llm-list.ts`, `anthropic-llm-list.ts`, etc.
- `lib/chat-setting-limits.ts`: Defines temperature/token limits per model
- Model configurations include context length, max output tokens, temperature ranges

### RAG/Retrieval System (`/lib/retrieval`)
- Document processing in `/lib/retrieval/processing/`: supports PDF, DOCX, CSV, JSON, TXT, MD
- Chunk size: 4000, overlap: 200 (defined in `processing/index.ts`)
- Uses `@xenova/transformers` for local embeddings
- Collections and file items stored in Supabase

### Frontend Structure (`/app/[locale]/[workspaceid]`)
- Next.js App Router with dynamic locale and workspace routing
- Main chat UI at `/[workspaceid]/chat/[chatid]`
- Components in `/components`:
  - `/chat`: Chat interface components
  - `/sidebar`: Sidebar with items (assistants, chats, files, folders, models, presets, prompts, tools, collections)
  - `/messages`: Message rendering, markdown, code blocks
  - `/ui`: Radix UI primitives + custom components
  - `/utility`: Global state, providers, settings, themes

### Chat Flow
1. User input handled by `components/chat/chat-input.tsx`
2. Chat handler in `components/chat/chat-hooks/use-chat-handler.tsx` orchestrates:
   - Message creation
   - Assistant/tool selection
   - Retrieval (if enabled)
   - API calls to appropriate provider
3. Response streaming processed in `components/chat/chat-helpers/`
4. Messages displayed in `components/chat/chat-messages.tsx`

### Supabase Setup
- Local development uses Supabase CLI with Docker
- Migrations in `supabase/migrations/`
- Critical: Update `project_url` and `service_role_key` in first migration (`20240108234540_setup.sql`) for proper storage deletion
- Auth configured in `supabase/config.toml`
- Default ports: API (54321), DB (54322), Studio (54323), Inbucket/Email (54324)

### Environment Variables
Key variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_OLLAMA_URL` (for local models)
- Optional API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GEMINI_API_KEY`, etc.
- Setting env vars for API keys disables user input for those keys
- `EMAIL_DOMAIN_WHITELIST`, `EMAIL_WHITELIST` for signup restrictions

### Internationalization
- Uses `i18next` with `next-i18n-router`
- Translations in `public/locales/[locale]/translation.json`
- Dynamic locale routing in app structure

### Common Patterns

**Supabase Queries**: Use `.maybeSingle()` instead of `.single()` when a row might not exist to avoid "multiple or no rows" errors

**Adding New Models**:
1. Add to provider-specific list in `lib/models/llm/[provider]-llm-list.ts`
2. Add limits to `lib/chat-setting-limits.ts`
3. Model configs include: `modelId`, `modelName`, `provider`, `hostedId`, `platformLink`, `imageInput` (boolean)

**File Processing**: Extend `lib/retrieval/processing/` for new file types, export from `index.ts`

**Database Changes**:
1. Create migration: Manually add SQL file to `supabase/migrations/`
2. Run `npm run db-migrate` to apply
3. Run `npm run db-types` to regenerate types (or use `npm run db-reset` for full reset)

## Notes

- Node version: v18+ required
- Uses PWA with `next-pwa`
- Markdown rendering with `react-markdown` + `remark-gfm` + `remark-math`
- Code highlighting with `react-syntax-highlighter`
- Uses Radix UI primitives extensively
- All database tables use `user_id` for multi-tenancy
- Workspace concept: Each user has a "home" workspace (`is_home: true`)

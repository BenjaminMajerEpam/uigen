# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # install deps, generate Prisma client, run migrations
npm run dev          # development server (Turbopack)
npm run build
npm test
npx vitest src/components/chat/__tests__/ChatInterface.test.tsx  # single test
npm run db:reset
npx prisma generate  # after schema changes
npx prisma migrate dev
```

## Environment

Set `ANTHROPIC_API_KEY` in `.env` to use real Claude. Without it, the app falls back to a `MockLanguageModel` that generates static sample components.

## Architecture

UIGen is a Next.js 15 App Router app where users chat with Claude to generate React components that render live in an iframe.

### Request Flow

1. User sends a message → `POST /api/chat`
2. Server calls Claude with AI tools (`str_replace_editor`, `file_manager`) and a system prompt (`src/lib/prompts/generation.tsx`)
3. Claude creates/edits files in the virtual file system via tool calls
4. `JSXTransformer` compiles changed files and the iframe re-renders

### Virtual File System

`src/lib/file-system.ts` — all files live in memory (no disk I/O), serialized to JSON and stored in the `data` column of the `Project` table. `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) provides shared state.

### JSX Preview Pipeline

`src/lib/transform/jsx-transformer.ts` uses Babel standalone to transpile JSX/TSX → JS inside the browser, then injects it into an iframe with an import map pointing to `esm.sh` for React dependencies.

### Auth

`src/lib/auth.ts` handles JWT sessions via `jose` (HttpOnly cookies, 7-day expiry, `server-only`). Server actions in `src/actions/` handle sign-up/in/out. Anonymous users can generate components — their work is tracked in localStorage via `src/lib/anon-work-tracker.ts`.

### Data Model

See `prisma/schema.prisma` for the authoritative schema. Summary:

```
User:    id, email, password (bcrypt), timestamps
Project: id, name, userId (optional), messages (JSON), data (JSON), timestamps
```

### Testing

Vitest + React Testing Library with jsdom. Test files live in `__tests__/` subdirectories alongside source.

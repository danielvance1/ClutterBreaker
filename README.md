# ClutterBreaker

A chores app that plays like a game. Parents post chores as "quests" with coin rewards. Kids mark them done, and parents approve or reject. Approval pays coins, breaks the quest card in half, and drops a chest with a random bonus. Kids spend coins in a parent-defined reward shop.

This repo currently holds the backend (Node, TypeScript, Express, PostgreSQL). The frontend comes later.

## Prerequisites

- Node 22
- Docker (for the dev database)

## First-time setup

```bash
cp .env.example .env
docker compose up -d
npm install
```

## Running

```bash
npm run dev                   # API with auto-reload on http://localhost:3000
curl localhost:3000/health    # {"status":"ok"}
```

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the API with auto-reload (reads `.env`) |
| `npm start` | Start the API once (reads `.env`) |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## More

The full design (data model, rules, API sketch, screens, chest odds) is in [`docs/design.md`](docs/design.md). Tickets are in `docs/tickets/`.

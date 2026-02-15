# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hatchery is an "AI Startup in a Box" — a monorepo that generates fully configured AI-agent companies from a startup pitch. Three packages work together:

- **cli** - Creates new AI startups via interactive wizard and scaffolding
- **engine** - Runtime system for agent teams, conversations, and memory
- **frontend** - Next.js dashboard with pixel-art UI for monitoring agents

## Commands

```bash
# Build all packages
npm run build

# Lint all packages
npm run lint

# Run frontend dev server
npm run dev

# Run CLI locally
cd packages/cli && npm start

# Individual package development (watch mode)
cd packages/cli && npm run dev
cd packages/engine && npm run dev
cd packages/frontend && npm run dev
```

### CLI Usage

```bash
# Create new AI company (interactive pitch meeting)
npx hatchery create my-startup --provider anthropic

# Skip pitch meeting with direct pitch
npx hatchery create my-startup --skip-meeting --pitch "AI news aggregator..."

# Check system health
npx hatchery doctor

# Manage secrets
npx hatchery secrets set KEY value
npx hatchery secrets list
```

## Architecture

### Data Flow

```
CLI (Wizard) → generates agents.json, policies.json, configs
    ↓
Engine (Runtime)
    ├── Heartbeat (main loop: triggers, reactions, conversations, memory)
    ├── Workers (parallel step executors)
    └── Database (Supabase Postgres)
    ↓
Frontend (Real-time Dashboard)
    └── Pixel Office, Signal Feed, Missions, Relationships, Memories
```

### CLI Package (`packages/cli/src`)

- **llm/** - Provider abstraction with factory pattern. `tiering.ts` selects models by cost tier (cheap|mid|expensive)
- **wizard/** - Core generation: pitch-meeting → revised-pitch → agent-generator → worker-generator → strategy-generator → config-generator
- **scaffolder/** - Handlebars template rendering from `/templates`
- **cli/commands/** - create, deploy, doctor, secrets implementations

### Engine Package (`packages/engine/src`)

- **core/heartbeat.ts** - Main event loop: evaluates triggers, processes reactions, promotes insights, schedules conversations
- **core/proposal-service.ts** - Creates/manages agent proposals with daily caps
- **workers/base-worker.ts** - Polls for pending steps, executes handlers, manages retries
- **conversations/orchestrator.ts** - Multi-agent dialogue with speaker selection and memory distillation
- **memory/store.ts** - Episodic/semantic memory with confidence-based ranking
- **relationships/tracker.ts** - Inter-agent affinity scores updated on interactions

### Frontend Package (`packages/frontend/app`)

- **components/office/** - Canvas-based pixel-art office with animated agent sprites
- **components/dashboard/** - Signal feed, mission list, D3 relationship graph, memory browser
- **api/** - Server routes for heartbeat status and event streams

## Key Concepts

**Proposals & Steps**: Agents submit proposals containing multiple steps. Steps pass through cap gate validation, then workers execute them.

**Memory Types**: insight, pattern, strategy, preference, lesson — all with confidence scores.

**Conversation Formats**: Brainstorm, standup, retrospective, etc. Speaker selection influenced by relationship affinity.

## Templates

`/templates` contains Handlebars templates for scaffolding:
- `base/` - .env.example, .gitignore, docker-compose.yml
- `config/` - agents.json.hbs, policies.json.hbs
- `workers/` - custom-worker.ts.hbs
- `systemd/` - Linux service files for heartbeat/workers

## TypeScript

- ES Modules throughout (type: "module")
- Target: ES2022, strict mode enabled
- Module resolution: NodeNext

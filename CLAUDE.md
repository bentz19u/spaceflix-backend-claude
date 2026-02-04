# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spaceflix Backend Claude is a NestJS 11 REST API backend for a Netflix-inspired streaming platform, using TypeORM with MySQL.

## Commands

- **Dev server:** `npm run start:dev` (watch mode, default port 3000)
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint with auto-fix)
- **Format:** `npm run format`
- **Unit tests:** `npm run test`
- **Single test:** `npx jest --testPathPattern=<pattern>` (e.g., `npx jest --testPathPattern=app.controller`)
- **E2E tests:** `npm run test:e2e`
- **Coverage:** `npm run test:cov`

## Architecture

- **Framework:** NestJS 11 with Express, TypeScript (ES2023 target, `nodenext` modules)
- **Database:** MySQL via TypeORM with async configuration from ConfigModule
- **Config:** `@nestjs/config` loaded globally; database settings read from `.env` (DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_SCHEMA)
- **API Docs:** Swagger UI at `/api`, auto-generated from controller decorators
- **TypeORM:** `autoLoadEntities: true` and `synchronize: true` (dev mode auto-schema sync)

### Module Pattern

NestJS modular structure rooted in `AppModule` (`src/app.module.ts`). New features should be added as separate modules with their own controllers, services, and entities, then imported into AppModule.

### Testing

- Unit tests: Jest with NestJS Testing Module (`*.spec.ts` in `src/`)
- E2E tests: Supertest against full app instance (`test/*.e2e-spec.ts`)

## Code Style

- Prettier: single quotes, no semicolons, trailing commas, 120 char width
- ESLint: flat config (`eslint.config.mjs`), `no-explicit-any` allowed, floating promises and unsafe arguments are warnings

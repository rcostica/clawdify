# Contributing to Clawdify

Thanks for your interest in contributing! Clawdify is a personal project, but PRs are welcome.

## Getting Started

1. **Fork & clone** the repo
2. **Install dependencies**: `npm install`
3. **Set up Supabase** (see README for schema)
4. **Copy env**: `cp .env.example .env.local` and fill in your values
5. **Run dev server**: `npm run dev`

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run typecheck # Run TypeScript checks
```

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Tailwind for styling (no CSS modules)
- shadcn/ui components where possible
- Zustand for client state
- Keep components small and focused

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run `npm run lint && npm run typecheck` 
4. Commit with a clear message
5. Push and open a PR

## What to Contribute

**Good first issues:**
- UI polish and accessibility improvements
- Documentation improvements
- Bug fixes
- New artifact renderers

**Bigger contributions (discuss first):**
- New major features
- Architecture changes
- New integrations

## Questions?

Open an issue or reach out. No formal process — just be respectful and keep PRs focused.

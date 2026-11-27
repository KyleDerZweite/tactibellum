# Tactibellum

- Read [PROJECT_SPEC.md](PROJECT_SPEC.md) before starting a roadmap phase. Keep changes within one phase or a defined slice, and verify its milestone before starting the next.
- Keep replay parsing, state reconstruction, patch data lookup, analytics, and export in framework-free TypeScript under `src/core/`. Keep React and browser APIs in the UI.
- Verify replay fields and game IDs against real samples or documented references. Keep unknown IDs representable as typed fallbacks.
- Keep replay data in the browser. Use original project assets and the design tokens in `src/styles/tokens.css`.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `VITE_BASE_PATH=/tactibellum/ pnpm build` before handoff. Check changed UI flows at desktop and mobile sizes with keyboard input.

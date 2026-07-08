# Web (Next.js)

The Consilience frontend: dashboard, live agent-trace view, and report UI. Deployed to Vercel.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run build
```

## Design system

Tokens live in [`src/app/globals.css`](src/app/globals.css) as CSS custom properties mapped into Tailwind 4's `@theme`; the living reference renders at [`/styleguide`](src/app/styleguide/page.tsx).

- **Surfaces**: warm paper (light) / deep graphite (dark), switching on `prefers-color-scheme` (explicit toggle ships with the dashboard in Milestone 1)
- **Accent**: teal — used for interaction and the mark, never for status
- **Confidence scale**: dedicated `high/mid/low` tokens reserved exclusively for evidence strength on claims
- **Type**: Newsreader (display), Inter (UI/body), JetBrains Mono (traces, citations, data) via `next/font`
- **Mark**: three lines of evidence converging on a point — [`src/components/logo.tsx`](src/components/logo.tsx), drawn with `currentColor`

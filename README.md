# Next.js + next-intl + PrimeReact skeleton

This is a minimal Next.js App Router project with internationalization via `next-intl` and UI components with `PrimeReact`. Ready to deploy on Vercel.

## Features
- App Router (`app/`)
- i18n with `next-intl` (locales: en, de)
- PrimeReact with theme, icons, and PrimeFlex
- Middleware-based locale routing

## Scripts
- `npm run dev` – Start dev server
- `npm run build` – Production build
- `npm start` – Start production server locally

## Local development
1. Install deps
```bash
npm install
```
2. Run dev server
```bash
npm run dev
```
Visit http://localhost:3000 which redirects to /en. Switch to German via the header link.

## Deploying to Vercel
- Push this repository to GitHub and import into Vercel.
- Framework preset: Next.js
- Build command: `next build`
- Output directory: `.next`
- No extra config is required; middleware handles locale prefixes.

## Notes
- To add more locales, extend `src/messages/*` and `src/i18n/config.ts`.
- PrimeReact themes can be changed by swapping the imported theme CSS in `app/[locale]/layout.tsx`.
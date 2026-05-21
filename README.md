# ThumbTrack

ThumbTrack is a mobile-first Next.js app for tracking daily thumb-pulling sets. It includes a daily dashboard, set timer, configurable daily target, checklist, calendar history, day notes, and basic streak/completion stats.

## Tech Stack

- Next.js 16 with the App Router
- TypeScript
- Supabase Auth and Postgres
- Supabase anonymous sign-ins for a no-friction MVP
- Plain CSS with responsive layouts

## Folder Structure

```text
.
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── thumb-track-app.tsx
├── lib/
│   ├── date.ts
│   ├── local-store.ts
│   ├── supabase.ts
│   ├── types.ts
│   └── use-thumbtrack.ts
├── supabase/
│   └── schema.sql
├── .env.example
├── eslint.config.mjs
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Supabase Setup

1. Create a Supabase project at [database.new](https://database.new).
2. Open **Authentication > Sign In / Providers** and enable **Anonymous sign-ins**.
3. Open the Supabase SQL editor and run [`supabase/schema.sql`](./supabase/schema.sql).
4. Open the project **Connect** dialog or **Settings > API Keys**.
5. Copy the project URL and a publishable key.
6. Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

The schema enables RLS on every public table and grants the current `authenticated` role the table privileges needed for Supabase's Data API. Rows are scoped to `auth.uid()`, so each anonymous user can only read and mutate their own habit data.

## Local Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

If `.env.local` is missing, ThumbTrack runs in local preview mode with `localStorage`; Supabase persistence turns on automatically once the environment variables and schema are in place.

## GitHub Setup

```bash
git init
git add .
git commit -m "Initial ThumbTrack MVP"
git branch -M main
git remote add origin https://github.com/<your-org-or-user>/thumbtrack.git
git push -u origin main
```

For deployment, add the same two environment variables to your host. On Vercel, set them under **Project Settings > Environment Variables**, then redeploy.

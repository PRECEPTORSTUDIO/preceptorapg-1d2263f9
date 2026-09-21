# PreceptorMED — Context for AI Coding Agents

## What this is

PreceptorMED is a medical education SaaS for Brazilian medical students. Core features:

- **AI-generated study summaries** ("fechamentos de PBL") with deep technical rigor
- **AI Chat** with PubMed integration for evidence-based answers in Portuguese
- **Flashcards** with proper SM-2 spaced repetition
- **Exam/ENAMED practice** with AI-generated clinical cases
- **Scientific Mentor** for academic work review
- **Gamification** (XP, streaks, badges, levels)
- **CRM Marketing** (lead intelligence, funnel, churn prediction, automations)
- **CRM Admin** (revenue, DRE, forecast, team, OKRs, delinquency)

Live at https://thepreceptor.com.br

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Edge Functions in Deno)
- **AI**: Claude (Anthropic API, `claude-sonnet-5`) via edge functions, através de `supabase/functions/_shared/claude.ts`. Exceção: `transcribe-consult` continua no Gemini porque o Claude não processa áudio
- **Payments**: EasyFlow (Brazilian) + Stripe (secondary)
- **Email**: Resend API
- **Hosting**: Vercel (frontend) + Supabase (backend)
- **Analytics**: Google Analytics (G-5YDQ04HZ52)

## Project Structure

```
src/
├── App.tsx                  # Router with lazy-loaded routes
├── pages/
│   ├── Landing.tsx          # Marketing landing page
│   ├── Auth.tsx             # Signup/login
│   ├── MainMenu.tsx         # Post-login home
│   ├── Dashboard.tsx        # Summary generation UI
│   ├── AIChat.tsx           # Chat with PubMed toggle
│   ├── Flashcards.tsx       # SM-2 review system
│   ├── Exam.tsx             # Exam generation from library
│   ├── Enamed.tsx           # ENAMED question bank
│   ├── Profile.tsx          # User profile + stats
│   ├── Pricing.tsx          # Plan selection
│   ├── ThankYou.tsx         # Post-purchase (/obrigado/:plano)
│   ├── crm/                 # CRM Marketing pages (admin only)
│   └── crm-admin/           # CRM Admin pages (financial/people)
├── components/
│   ├── layout/DashboardLayout.tsx  # Main app sidebar + shell
│   ├── crm/                 # CRM Marketing components
│   ├── crm-admin/           # CRM Admin components
│   ├── ErrorBoundary.tsx    # Crash protection
│   ├── GamificationWidget.tsx
│   └── OnboardingTour.tsx
├── hooks/
│   ├── useGamification.ts   # XP, SM-2, achievements
│   ├── useCrm.ts            # CRM data hooks
│   ├── useAdminDashboard.ts # Admin metrics
│   └── useSubscription.ts   # Subscription status
├── contexts/
│   ├── AuthContext.tsx      # Main app auth (Supabase)
│   └── CrmAuthContext.tsx   # Separate CRM auth (service account)
└── lib/
    └── crm/                 # CRM queries + supabase client

supabase/
├── functions/               # Deno edge functions
│   ├── generate-fechamento/ # Main AI summary generator
│   ├── generate-exam/       # Exam generator
│   ├── generate-enamed/     # ENAMED generator
│   ├── generate-flashcards/ # Flashcard generator
│   ├── ai-chat/             # Chat with PubMed
│   ├── scientific-mentor/   # Academic review
│   ├── easyflow-webhook/    # Payment webhook (HMAC validated)
│   ├── stripe-webhook/      # Secondary payment webhook
│   ├── crm-auth/            # CRM login (separate auth)
│   ├── crm-admin-actions/   # Admin operations (bypasses RLS)
│   ├── crm-api/             # External CRM API
│   ├── crm-automations/     # Email automation engine
│   ├── inadimplencia-cron/  # Daily delinquency check
│   ├── health-score/        # Student engagement scoring
│   ├── churn-prediction/    # Churn ML engine
│   ├── lead-score/          # Lead scoring
│   ├── send-custom-email/   # Admin manual email sending
│   └── delete-user/         # User data deletion
└── migrations/              # SQL migrations
```

## Core Conventions

### Frontend

- **Always use `supabase` from `@/integrations/supabase/client`** for user-facing queries (respects RLS)
- **CRM uses `supabaseCrm` from `@/integrations/supabase/crm-client`** with separate auth storage key (`sb-crm-auth-token`)
- **CRM admin operations** that need to bypass RLS should go through the `crm-admin-actions` edge function, NOT direct client queries — client-side subscription writes fail silently due to RLS
- **Lazy load all routes** in App.tsx using `React.lazy()` + `Suspense`
- **Use existing design tokens**: primary green `#006D5B`, dark green `#005344`, gold `#C9A84C`
- **Fonts**: `Manrope` for headings, `DM Sans` / `Inter` for body
- **Mobile-first**: All CRM pages have `md:hidden` card views for tables (see CrmLeads, CrmHealth patterns)
- **NO `key={location.pathname}` on main content wrappers** — it causes screen flash on navigation

### Edge Functions

- **Claude API**: Never call the Anthropic API directly. Use the helpers in `supabase/functions/_shared/claude.ts` (`claudeText`, `claudeJson`, `claudeSseStream`, `claudeStreamText`, `pdfBlock`). Model comes from `CLAUDE_MODEL` (default `claude-sonnet-5`); one model for everything. Prompt caching is on by default (breakpoint on the system prompt + automatic on the last block), so keep system prompts stable and put volatile content in the user message
- **No `temperature`**: Claude 5 models reject it. Control depth with `effort` (`low` for chat/extraction, `medium` default, `high` for fechamentos, exams, ENAMED, clinical cases, study plans)
- **Structured JSON**: pass the schema in `jsonSchema` (the helper normalizes Gemini-style schemas). `jsonOnly: true` when there is no schema
- **Auth**: Use `supabaseClient.auth.getClaims(token)` with user's Bearer token to validate
- **Rate limiting**: Check `generation_logs` table before calling AI API (5 requests / 5 min)
- **Streaming**: `claudeSseStream` already emits the SSE format the frontend consumes (`data: {choices: [{delta: {content}}]}\n\n` + `data: [DONE]`). Extra events go in `prelude` / `onFinish`
- **Service role**: Create separate `serviceClient` with `SUPABASE_SERVICE_ROLE_KEY` for admin ops

### Database

- **MRR baseline**: Only count subscriptions from `2026-04-07` onwards (reset to zero before that date)
- **Subscription status**: `active | inactive | inadimplente`
- **Plan types**: `monthly | annual | biannual | free_access | none`
- **Plan prices** (in cents): monthly=4990, annual=35090/12, biannual=59990/6
- **RLS is enforced** on all user data tables — use service_role_key in edge functions when needed

## Key Business Logic

### Subscriptions Flow

```
User signs up → profile created via trigger
User pays on EasyFlow → webhook → subscriptions table updated → crm_leads.status = "subscriber"
User fails payment → webhook → subscriptions.status = "inadimplente" + admin_inadimplencias record created
Daily cron (inadimplencia-cron) → sends D+1, D+5, D+10 emails → auto-cancel at D+15
```

### AI Generation Rate Limiting

```
Free users: 2 AI chat messages/day (enforced via generation_logs table)
Paid users: Unlimited, rate-limited to 5 generations per 5 minutes
Admin users: Unlimited, no rate limit
```

### Gamification (SM-2 + XP)

```
Flashcard review → SM-2 algorithm updates ease/interval → XP awarded (easy=10, good=5, hard=3, again=1)
Daily activity → +15 XP bonus (once per day)
Streaks → bonus XP at 3/7/14/30 days
Achievements → 12 badges auto-checked after each review
Level progression → Calouro → Estudante → Academico → Interno → Residente → Preceptor → Professor Titular
```

## Development Commands

```bash
# Dev server (port 8080)
npm run dev

# Build
npm run build

# Deploy frontend to Vercel (requires token)
npx vercel deploy --prod --yes --token $VERCEL_TOKEN --scope matheus-castros-projects-3aec77a2

# Deploy edge function
SUPABASE_ACCESS_TOKEN=$TOKEN npx supabase functions deploy <function-name> --project-ref qnyxluevbogwwtwtbpuu --no-verify-jwt

# Apply database migration
SUPABASE_ACCESS_TOKEN=$TOKEN npx supabase db push --yes

# Supabase project ref
qnyxluevbogwwtwtbpuu
```

## Known Issues / Pitfalls

1. **CRM data bugging out**: If MRR/subscribers show as 0, it's because RLS blocks client queries on `subscriptions`. Use `crm-admin-actions` edge function instead
2. **White screen on /admin/crm**: Usually caused by JS crash in CrmAuthContext. All try-catches should be defensive
3. **Claude API errors**: a 400 usually means `temperature` or another removed parameter was passed, or a schema with unsupported constraints. `toClaudeError` maps SDK errors to HTTP status + `retryable`
4. **Webhook failures**: EasyFlow doesn't always send signatures. Current code logs invalid signatures but doesn't block (non-strict mode)
5. **Screen flash on navigation**: Don't use `key={pathname}` on layout wrappers — it unmounts/remounts the whole subtree
6. **Build chunk size**: Main bundle is 308KB after code splitting. `vendor-pdf` chunk is 618KB (heavy but rarely used)

## What NOT to do

- ❌ Don't expose `SUPABASE_SERVICE_ROLE_KEY` in frontend (VITE_ prefix) — critical security issue
- ❌ Don't concatenate `systemPrompt + userPrompt` into a single user message, and don't fake system prompts as user/assistant turns — use the `system` option
- ❌ Don't write directly to `subscriptions` from the frontend client — RLS blocks it silently
- ❌ Don't pass `temperature` to Claude — the request fails with 400. Use `effort`
- ❌ Don't add `animate-fade-up` with `opacity: 0` to layout wrappers — causes flash
- ❌ Don't commit `.env` or `.claude/settings.local.json` — contains secrets (GitHub Push Protection will block)
- ❌ Don't create new `crm_admin_users` flows — use existing `crm-auth` edge function pattern
- ❌ Don't skip `system` prompt validation on PR — this breaks the core product silently

## Secrets / Environment

Frontend `.env` (public, VITE_ prefixed):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key, safe to expose)
- `VITE_SUPABASE_PROJECT_ID`

Supabase Edge Function secrets (`supabase secrets list`):
- `ANTHROPIC_API_KEY` (Claude, all AI functions)
- `CLAUDE_MODEL` (optional override, default `claude-sonnet-5`)
- `CLAUDE_FALLBACKS` (optional, `off` disables server-side refusal fallback)
- `GOOGLE_AI_API_KEY` (Gemini, only `transcribe-consult` audio transcription)
- `RESEND_API_KEY` (emails)
- `CRM_TOKEN_SECRET` (HMAC for CRM auth tokens)
- `CRM_SERVICE_EMAIL` / `CRM_SERVICE_PASSWORD` (CRM service account)
- `EASYFLOW_API_KEY` / `EASYFLOW_API_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

## Deployment

**Frontend**: Auto-deploys on push to `main` branch via Vercel integration. Manual deploy: `npx vercel deploy --prod`

**Edge Functions**: Manual deploy only. Run `npx supabase functions deploy <name>` for each function changed.

**Migrations**: Manual apply. Run `npx supabase db push` after creating new SQL file in `supabase/migrations/`.

---

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons)
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Enable Web Analytics + Speed Insights early
<!-- VERCEL BEST PRACTICES END -->

# Life Admin

AI-powered personal chief-of-staff for life administration.

## Deploy to Vercel

1. Import this repo in [Vercel](https://vercel.com).
2. **Framework preset:** Other (static).
3. **Root Directory:** leave **empty** (repository root — do not set `frontend` here).
4. **Build / Output:** leave empty in the dashboard so `vercel.json` applies (`buildCommand`: `npm run vercel-build`, `outputDirectory`: `frontend`).
5. **Environment variables** (Production + Preview):

| Variable | Required | Example |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | `eyJhbG...` (anon public key) |
| `DEV_USER_ROLE` | No | `user` |
| `DEV_USER_PLAN` | No | `ai_chief_of_staff` |
| `DEV_PREFER_CONFIG` | No | `false` for real auth/plan from Supabase |
| `DEV_USER_EMAIL` | No | |
| `DEV_USER_FULL_NAME` | No | |

6. Deploy. All routes rewrite to `index.html` for client-side navigation (Today / Vault / AI).

### Vercel shows 404?

This almost always means the **output path is wrong** in project settings:

| Setting | Correct value |
|---------|----------------|
| Root Directory | *(empty)* |
| Output Directory | *(empty — use `vercel.json`)* **or** `frontend` (not both `frontend` root **and** `frontend` output) |

Wrong combo that causes 404: Root Directory = `frontend` **and** Output Directory = `frontend` (Vercel looks for `frontend/frontend/index.html`).

After fixing settings, **Redeploy** → Deployments → ⋮ → Redeploy. Then hard-refresh the site (Cmd+Shift+R).

### Local production build

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
npm install
npm run build
cd frontend && python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`.

### PWA

- `manifest.webmanifest` + service worker (`sw.js`)
- Install prompt appears when the browser supports it (Chrome / Edge / Android)
- Add to Home Screen on iOS via Share → Add to Home Screen

Icons: `frontend/icons/icon-192.png` and `icon-512.png` are committed for install prompts; `npm run build:icons` can regenerate them from `icon.svg` when `sharp` is available (Node 18+).

---

## Supabase setup

Run SQL in this order in **Supabase SQL Editor**:

1. [`supabase/schema.sql`](supabase/schema.sql) — reminders table
2. [`supabase/migrations/003_users_architecture.sql`](supabase/migrations/003_users_architecture.sql) — users, roles, plans, entitlements (includes 002 prerequisites)
3. [`supabase/migrations/004_tasks.sql`](supabase/migrations/004_tasks.sql) — tasks + recurring rules
4. [`supabase/migrations/005_vault_documents.sql`](supabase/migrations/005_vault_documents.sql) — family document vault
5. [`supabase/migrations/006_vault_intelligence_links.sql`](supabase/migrations/006_vault_intelligence_links.sql) — vault ↔ reminder links
6. [`supabase/migrations/007_family_management.sql`](supabase/migrations/007_family_management.sql) — family members, family reminders, task assignees
7. [`supabase/migrations/008_notification_states.sql`](supabase/migrations/008_notification_states.sql) — notification read / snooze / dismiss state
8. [`supabase/migrations/009_planning_calendar.sql`](supabase/migrations/009_planning_calendar.sql) — calendar time blocks
9. [`supabase/migrations/010_life_event_workflows.sql`](supabase/migrations/010_life_event_workflows.sql) — life event workflow instances
10. [`supabase/migrations/011_workflow_engine_types.sql`](supabase/migrations/011_workflow_engine_types.sql)
11. [`supabase/migrations/012_context_memory.sql`](supabase/migrations/012_context_memory.sql)

**Storage (optional):** create a private bucket `vault-documents` in Supabase Storage.

### Config (local)

- Copy [`.env.example`](.env.example) to `.env` and run `npm run build:config`
- Or copy [`frontend/config.example.js`](frontend/config.example.js) values into [`frontend/config.js`](frontend/config.js)

**Do not commit real Supabase keys.** Use Vercel env vars in production.

---

## User architecture (no billing)

### `public.users` table

| Column | Description |
|--------|-------------|
| `id` | UUID (matches `auth.users`) |
| `email` | User email |
| `full_name` | Display name |
| `role` | `user` · `founder` · `admin` |
| `plan` | `free` · `family_premium` · `ai_chief_of_staff` |
| `created_at` | Signup timestamp |

### Roles

| Role | Access |
|------|--------|
| **user** | Subject to plan restrictions |
| **founder** | Unlimited features + beta + experimental |
| **admin** | Manage users & plans (UI placeholders) + analytics placeholders |

### Plans

| Plan | Includes |
|------|----------|
| **free** | MOT, passport, licence, basic dashboard |
| **family_premium** | All categories, priorities, unlimited items, family management |
| **ai_chief_of_staff** | Premium + AI assistant + beta/experimental flags |

### Dev testing

Set in `.env` or `frontend/config.js` after build:

```js
window.DEV_USER_ROLE = "founder";
window.DEV_USER_PLAN = "ai_chief_of_staff";
window.DEV_PREFER_CONFIG = true;
```

### Frontend modules

- `access.js` — roles, plans, feature gates (founder bypasses all)
- `profile.js` — loads `users` row from Supabase
- `onboarding.js` — first-use flow
- `deploy-boot.js` — loading overlay, PWA install, global errors
- See `frontend/` for vault, AI, workflows, context engine, actions

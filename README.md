# Life Admin

AI-powered personal chief-of-staff for life administration.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Copy your **Project URL** and **anon public** key from **Project Settings → API**.
4. Paste them into [`frontend/config.js`](frontend/config.js):

   ```js
   window.SUPABASE_URL = "https://xxxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJhbG...";
   ```

5. Serve the frontend (opening `index.html` directly may block API calls in some browsers):

   ```bash
   cd frontend && python3 -m http.server 8080
   ```

   Open http://localhost:8080

## Features

- Dashboard: “What do I need to do today?” with notification badge
- **Today's Priorities** card for urgent items (shown in red)
- Smart notifications:
  - MOT due within 30 days
  - Passport due within 90 days
  - Driving licence due within 90 days
  - Subscriptions due today
  - Bills due within 30 days
- MOT, passport, driving licence, subscription, and bill reminders
- Data stored in Supabase (`life_admin_items` table)
- Mobile-first UI with urgent item highlighting

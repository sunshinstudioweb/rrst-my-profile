# RRST.FASHION — My Profile

A responsive React + Vite starter for the separate RRST.FASHION profile and friend network. Shopify remains the separate store/checkout.

## Included
- Email + password sign up/sign in UI
- Public/private profile selector
- Editable name, bio and profile photo preview
- Discover people UI
- Friend request inbox, accept/decline
- Friends list
- Responsive design for mobile and desktop
- Vercel SPA rewrite configuration
- Supabase schema with row-level security policies

## Run locally
1. Install Node.js 20+.
2. In this folder run:
   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```
3. Open the local URL printed by Vite.

## Enable real accounts and social features
1. Create a Supabase project.
2. In Supabase **SQL Editor**, run `supabase/schema.sql`.
3. In Supabase **Project Settings → API**, copy Project URL and the `anon`/publishable key.
4. Put them in `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```
5. In Supabase Authentication settings, configure the Site URL and allowed redirect URLs for local development and your deployed Vercel domain.
6. Restart `npm run dev`.

Never put a Supabase `service_role` key in this frontend.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel choose **Add New → Project** and import the repository.
3. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables.
5. Deploy.

The Vercel project gets a `*.vercel.app` URL. To use `profile.rrst.fashion`, add that domain in Vercel and configure the DNS records Vercel displays.

## Important before public launch
- The current Discover screen includes sample/demo cards to preview the UI. Replace them with a real searchable member query before launch.
- This is a starter, not a completed production social network. Add server-validated friend-request rate limits, report/block flows, image storage with file-size/type checks, account deletion, abuse moderation and tests before a public launch.
- Profile photos currently preview locally in the editor; configure a Supabase Storage bucket and upload flow for persistent photos.
- Public/private controls protect profile row visibility through RLS. If adding photos, posts or other content tables, apply equivalent privacy policies to those tables too.
- The QR code feature should generate a permanent URL based on an immutable user or product identifier after deployment. Do not print QR codes pointing at a temporary preview URL.

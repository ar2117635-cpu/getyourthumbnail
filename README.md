# GetYourThumbnail — MVP

A deployable Next.js MVP for the GetYourThumbnail project.

## What works in this MVP
- Responsive landing page and thumbnail studio.
- Video selection in the browser (up to 500 MB; actual limit depends on device/browser memory).
- Captures a frame from the selected video.
- Generates two 1280×720 template-based thumbnail concepts in the browser.
- Edit headline and subheading, then download PNG.
- Two-per-day demo counter stored in the current browser/device.
- Optional Supabase email/password authentication.
- Supabase SQL schema for profiles, projects, and daily usage.
- Privacy and Terms starter pages.

## Important feature boundaries
This is a functional MVP, not the finished 84+ feature SaaS platform.
- The current generator uses a frame from the uploaded video plus canvas design templates. It does **not** call a generative AI model.
- The video is processed locally in the browser; this version does not upload videos to cloud storage.
- Demo usage limits are stored in localStorage and are not secure/server-enforced.
- Real user accounts require Supabase environment variables.
- Payment processing, subscriptions, affiliate commissions, advertiser marketplace, admin controls, 21-language translations, cloud project sync, 4K export and AI model integration are future phases.
- Privacy and Terms pages are starter templates and must be reviewed before commercial launch.

## Run locally
1. Install Node.js 20 or later on a computer.
2. Extract this ZIP.
3. Open a terminal in the project folder.
4. Run `npm install`.
5. Copy `.env.example` to `.env.local`.
6. Add Supabase values if you want real accounts. Without them, the studio still works in local demo mode.
7. Run `npm run dev`.
8. Open `http://localhost:3000`.

## Supabase setup (optional for this MVP)
1. Create a free project at https://supabase.com.
2. Open Project Settings → API.
3. Copy Project URL and anon/public key into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Open SQL Editor and run `supabase/schema.sql`.
5. In Authentication → Providers, enable Email.
6. Add your deployed website URL to Authentication → URL Configuration.

Never put a Supabase service-role key in frontend environment variables.

## Deploy to Vercel
1. Create a GitHub account and sign in.
2. Create a new repository, e.g. `getyourthumbnail-mvp`.
3. Upload the extracted project files to the repository (keep folder structure).
4. Sign in at https://vercel.com using GitHub.
5. Select **Add New → Project**, import `getyourthumbnail-mvp`.
6. Framework should be detected as Next.js. Keep the default build command.
7. If using Supabase, add the two `NEXT_PUBLIC_...` environment variables in Vercel → Project Settings → Environment Variables.
8. Click Deploy. Wait for the deployment to finish.
9. Open the generated `*.vercel.app` URL.
10. If Supabase auth is enabled, add that exact URL to Supabase Authentication → URL Configuration.

## Deploy from Android
The easiest route is browser-based:
1. Extract the ZIP using your phone's Files app.
2. Open GitHub in Chrome and create a repository.
3. Upload the files while preserving folders. If GitHub's mobile upload is difficult, use GitHub's web editor or a computer.
4. Open Vercel in Chrome, sign in with GitHub, import the repository and deploy.
5. Configure Supabase environment variables in Vercel if you created a Supabase project.

A public Vercel URL is available after a successful deployment. A custom domain such as getyourthumbnail.ai is separate and requires domain ownership/configuration.

## Before inviting real customers
- Add server-side generation quotas and abuse protection.
- Add secure cloud storage and project ownership.
- Add a real AI provider/model and moderation.
- Complete legal/privacy review and data-retention rules.
- Add monitoring, backups, rate limiting and production security tests.

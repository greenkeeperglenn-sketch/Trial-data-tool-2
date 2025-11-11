# Supabase Setup Checklist

Use this checklist to verify your Supabase is properly configured.

## ✅ Step 1: Environment Variables (Vercel)
- [ ] Go to https://vercel.com/dashboard
- [ ] Click your **Trial-data-tool-2** project
- [ ] Go to **Settings** → **Environment Variables**
- [ ] Add `VITE_SUPABASE_URL` = `https://fdzdjnzknbyoxqjfqnxr.supabase.co`
- [ ] Add `VITE_SUPABASE_ANON_KEY` = `eyJhbGci...` (your full anon key)
- [ ] Check all environments: Production, Preview, Development
- [ ] **Redeploy** the site after adding variables

## ✅ Step 2: Database Migration
- [ ] Go to https://supabase.com/dashboard
- [ ] Click your project
- [ ] Go to **SQL Editor** (left sidebar)
- [ ] Click **"New query"**
- [ ] Copy ALL contents from `supabase-migration.sql` file
- [ ] Paste into SQL editor
- [ ] Click **"Run"** button
- [ ] Verify: Go to **Table Editor** → Should see `trials` table

## ✅ Step 3: Disable Email Confirmation (for testing)
- [ ] In Supabase dashboard: **Authentication** → **Providers**
- [ ] Click **Email**
- [ ] Scroll down to **"Confirm email"** section
- [ ] **Toggle OFF** "Enable email confirmations"
- [ ] Click **Save**

## ✅ Step 4: Test Sign Up
- [ ] Visit your Vercel deployment URL
- [ ] You should see: "STRI Trial Data Tool" with Login/Sign Up tabs
- [ ] Click **"Sign Up"** tab
- [ ] Enter test email: `test@example.com`
- [ ] Enter password (min 6 characters)
- [ ] Click Sign Up button
- [ ] You should be logged in immediately (no email verification)

## ✅ Step 5: Verify Database Storage
- [ ] After signing up and logging in, create a new trial
- [ ] Add some test data
- [ ] Go back to Supabase dashboard → **Table Editor** → **trials**
- [ ] You should see your trial data stored there

## 🔍 Troubleshooting

**Still seeing "Configuration Required" error?**
- Environment variables not added to Vercel, or
- Site not redeployed after adding variables

**Can see login screen but sign up fails?**
- Database migration not run (no `trials` table exists)

**Sign up works but can't create trials?**
- Check browser console for errors
- Verify `trials` table exists in Supabase Table Editor

**Email verification required but don't want to use real email?**
- Disable "Confirm email" in Supabase Authentication settings

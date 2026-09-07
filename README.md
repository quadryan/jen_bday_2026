# Jen's 23rd Birthday Wish Compilation

A Vercel-ready birthday wish wall for Jennifer Lee / 이채은. Friends can submit a photo and note, see their own submission immediately, and browse a blurred wall until the reveal is switched on.

The wall keeps each photo's aspect ratio, so portrait, square, and landscape polaroids can all sit together without forced square cropping.

## Local Setup

```bash
npm install
npm run dev
```

Without Supabase environment variables, the app uses temporary in-memory storage. Local submissions reset when the dev server restarts.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add these environment variables locally and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=wish-photos
ADMIN_PASSCODE=choose-a-private-passcode
```

The service role key is used only on server routes. Do not expose it with a `NEXT_PUBLIC_` prefix.

## Placeholder Photos

The public wall starts with zero actual wishes. To make the canvas feel populated before submissions arrive, drop Jen photos into `public/placeholders` using these filenames:

```text
jen-01.jpg
jen-02.jpg
jen-03.jpg
jen-04.jpg
jen-05.jpg
jen-06.jpg
jen-07.jpg
jen-08.jpg
```

Those photos show only while there are no submitted wishes, and they do not count as entries.

HEIC files are not reliable in every browser. The uploader will convert them when the browser can read them, but JPG/PNG/WebP/GIF are the safest formats.

## Pages

- `/` is the public submission page.
- `/reveal` is the final wall page.
- `/adminryan` lets you add, edit, delete, and flip the reveal switch.

In local development only, if `ADMIN_PASSCODE` is empty, the temporary admin passcode is `jen23`.

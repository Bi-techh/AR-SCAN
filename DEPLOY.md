# Deploy FrameCast AR with Supabase and Vercel

## 1. Create Supabase project

1. Go to Supabase and create a free project.
2. Open **SQL Editor**.
3. Run the SQL in `supabase-setup.sql`.
4. Open **Project Settings > API**.
5. Copy your **Project URL** and **anon public key**.

## 2. Connect this app

Edit `src/config.js`:

```js
export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
export const SUPABASE_BUCKET = "framecast";
```

After that, **Owner setup** uploads each frame image and video to Supabase, saves a frame record, and generates a scan link/QR code.

## iPhone support

iPhone Safari does not support WebXR image tracking. This app uses a MindAR fallback for iPhone/unsupported browsers.

For each frame:

1. Compile the same frame image into a `.mind` target file using the MindAR image target compiler.
2. In **Owner setup**, upload the frame image, video, and `.mind` file.
3. Save the frame experience.

When an iPhone opens the scan link and taps **Scan frame**, the app redirects to `mindar.html` and uses the `.mind` target.

## 3. Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Use the default static site settings.
4. Deploy.

Your QR links will then look like:

```text
https://your-site.vercel.app/?frame=frame-001-abcd1234
```

## Production note

This starter uses public read/upload policies so the prototype is easy to test. Before real launch, add an owner login and move uploads behind a protected API route so only you can create new frame records.

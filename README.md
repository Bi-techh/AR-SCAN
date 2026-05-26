# FrameCast AR

A browser prototype for image-tracked augmented reality. Each saved frame image and video creates a unique scan link and QR code.

## Run

```powershell
python -m http.server 5173
```

Open `http://localhost:5173`.

## Business flow

1. Open **Owner setup**.
2. Upload the picture/frame image that should trigger AR.
3. Upload the video that should appear inside that frame.
4. Save the frame experience.
5. The dashboard generates a unique frame ID, scan link, and downloadable QR code.
6. Give the client the scan link or print the QR code. The client uses **Client scan** only.

This prototype saves frame experiences in the browser for demo purposes. A production version should save each purchased frame and video on a server, then give every client a unique hosted scan link or QR code.

## Demo limitation

Without Supabase config, the QR links point back to this local app and only work where the same browser has the saved frame records. With Supabase configured in `src/config.js`, QR links can load frame records and media from the cloud.

See `DEPLOY.md` for the Supabase and Vercel setup.

## Device note

WebXR image tracking support is limited. Chrome on Android is the best target, and some versions require enabling WebXR experimental features. iPhone Safari does not currently support this WebXR image-tracking flow.

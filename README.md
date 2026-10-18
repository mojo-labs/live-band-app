# Diwali Setlist

Stage-ready setlist for the band: lyrics, chords transposed to the set key, auto-scroll, running order. Static page plus one serverless function that keeps the shared setlist in Redis.

## Deploy (about 3 minutes)

1. In this folder, run `npx vercel --prod` and accept the defaults (or push the folder to a GitHub repo and import it at vercel.com/new).
2. In the Vercel project: **Storage → Create Database → Upstash Redis** (free tier). Connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. Open the URL on your iPad. On first load the page pushes its built-in setlist to the store. To bring over the setlist from the Claude artifact: there, **Copy / paste data → Copy**; here, **Copy / paste data → paste → Replace with pasted text**.

Every device reads and edits the shared setlist with no sign-in; keep the URL within the band. Pages refresh from the server every 6 seconds and whenever they come back to the foreground.

## Files

- `index.html` — the whole app.
- `api/setlist.js` — GET returns the setlist, PUT saves it (last write wins by timestamp; a stale save gets 409 and the newer version back). No authentication: anyone with the URL can edit.

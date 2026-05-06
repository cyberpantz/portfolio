# Deployment

## Platform

**Netlify** — static site hosting (free tier).

The site uses `output: 'static'` (Astro default), so the build produces a plain `dist/` folder with no server required.

---

## First deploy

### 1. Push to GitHub

Make sure the repo is on GitHub (public or private both work with Netlify free tier).

### 2. Connect to Netlify

1. Go to [netlify.com](https://netlify.com) and sign up / log in
2. **Add new site → Import an existing project → GitHub**
3. Authorize Netlify and select this repo

### 3. Configure build settings

Netlify usually auto-detects Astro, but verify:

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Publish directory | `dist` |
| Node version | `20` (set in Environment Variables: `NODE_VERSION = 20`) |

Click **Deploy site**. Netlify will give you a URL like `your-site.netlify.app`.

---

## Custom domain (frankyoung.dev)

The simplest approach is to delegate DNS to Netlify so it can manage records and auto-renew SSL.

### Step 1 — Add domain in Netlify

1. Site settings → **Domain management → Add custom domain**
2. Enter `frankyoung.dev` → Verify
3. Netlify will show you its nameservers, something like:
   ```
   dns1.p01.nsone.net
   dns2.p01.nsone.net
   dns3.p01.nsone.net
   dns4.p01.nsone.net
   ```

### Step 2 — Point Namecheap to Netlify

1. Log in to Namecheap → **Domain List → Manage** on `frankyoung.dev`
2. Under **Nameservers**, select **Custom DNS**
3. Enter the four Netlify nameservers from Step 1
4. Save — DNS propagation takes up to 24 hours (usually under 1 hour)

### Step 3 — SSL

Once DNS propagates, Netlify auto-provisions a Let's Encrypt certificate. No action needed — HTTPS will be live automatically.

---

## Ongoing workflow

```
git push origin main
```

Netlify watches the main branch and redeploys automatically on every push. Deploys typically finish in under 60 seconds.

---

## Local build check

Before pushing, verify the production build works locally:

```bash
pnpm build       # builds to dist/
pnpm preview     # serves dist/ at localhost:4321
```

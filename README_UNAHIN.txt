GITHUB PAGES — PLAYER DIAGNOSTICS DASHBOARD

Suggested NEW repo name: bida-reels-player-diagnostics

1. Upload ALL files inside this folder to that repo's ROOT.
   index.html must be directly in the repo root, beside app.mjs, styles.css,
   diagnostics-model.mjs and favicon.svg. Keep .nojekyll too.
2. GitHub repo Settings > Pages:
   Source: Deploy from a branch
   Branch: main
   Folder: / (root)
3. Save, then open the Pages URL shown by GitHub after deployment.
No npm install or frontend build command is required.

TWO MODES
IMPORTED REPORT: Works independently of the live backend. In the Android app,
Settings > Diagnostics > Copy report. On the page, Import app report > paste >
Load report. JSON/text files up to 1 MB are supported. Select an episode to
inspect its timeline. Copy report exports that episode; Copy all exports the
current filtered set. If browser clipboard access is blocked, the page exposes
selected text for manual copying.

LIVE DASHBOARD: Deploy 02_Cloudflare_Backend first. Select Live dashboard and
use the existing API URL and Firebase administrator account. Email/password
and Google sign-in are supported. Firebase SDK is loaded from Google's official
CDN only when signing in, with in-memory authentication persistence.

For Google sign-in, add the Pages hostname (for example missnapokita.github.io)
to Firebase Authentication > Settings > Authorized domains. Google sign-in must
be enabled for the Firebase project. Use an account included in ADMIN_UIDS.

The backend CORS origin must match the Pages ORIGIN:
  https://missnapokita.github.io
The repo path is not part of the origin. If using another username/domain,
update the API Worker's BIDA_DIAGNOSTICS_ORIGINS build variable and redeploy API.

The dashboard reads up to 60 latest sessions, refreshes every 15 seconds while
visible and signed in, and marks data older than 90 seconds as stale. Counters
reflect the currently fetched/filtered set. Detail reports show client device,
engine, provider, title, episode, stages, timing, codecs and recorded errors.
The server anonymous client tag does not expose a raw Firebase UID or email.

This repo contains only static interface files. Live reports remain in D1 and
are fetched through the authenticated admin endpoint. No live reports or keys
need to be committed to GitHub. Logout clears the live view and in-memory auth.

No GitHub repo was created or published from this session because the connected
GitHub API could not access the existing backend repo (404). These files are
ready for your normal upload workflow. A local browser QA checked report import,
provider filtering, event details, signed-out live mode and clipboard fallback
using clearly labelled synthetic QA data; no sample reports are shipped here.

References:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
https://firebase.google.com/docs/web/alt-setup
https://developers.cloudflare.com/d1/reference/migrations/

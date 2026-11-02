GCG HUB NEWS UPDATE

GitHub Pages: replace css/index.css and js/index-app.js.
Cloudflare: paste worker/news-worker.js into your existing Worker and deploy.

Changes:
- Every available image in a post now displays in a responsive grid.
- Clicking an image enlarges that individual image.
- Worker retains a separate backup cache for up to 7 days and serves it when both RSS mirrors fail.
- Normal successful feed refresh remains 30 minutes.

Note: Cloudflare Cache API is per data centre, can be evicted, and cannot guarantee persistence.
The fallback becomes available after the updated Worker successfully fetches at least one feed.
The Worker source was reconstructed from the code you pasted; compare instance URLs and other settings with your live Worker before deploying.

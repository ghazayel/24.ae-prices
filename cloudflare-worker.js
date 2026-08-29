// Cloudflare Worker — a tiny relay we control, replacing the unreliable
// public CORS proxies. Deployed for free on Cloudflare's own infrastructure,
// which runs on IP ranges that generic anti-scraping rules are far less
// likely to block (unlike well-known shared proxy services).
//
// What it does: fetches https://dubaicityofgold.com/ server-side (no CORS
// applies to server-to-server requests) and returns the HTML back to our
// page with permission (Access-Control-Allow-Origin) to read it.
//
// Deployment: see SETUP_GUIDE.md "Your own reliable relay (Cloudflare
// Worker)" section — takes about 5 minutes, free, no credit card needed.

const TARGET_URL = 'https://dubaicityofgold.com/';

// Restrict who can call this Worker to just your own GitHub Pages site,
// so it can't be casually reused as an open proxy by anyone who finds the URL.
const ALLOWED_ORIGIN = 'https://ghazayel.github.io';

export default {
  async fetch(request) {
    // Handle the browser's preflight check
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    try {
      const upstream = await fetch(TARGET_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoldCardBot/1.0; +https://ghazayel.github.io)' },
        cf: { cacheTtl: 0 }, // always fetch fresh, never serve a cached/stale copy
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return new Response('Upstream fetch failed: ' + err.message, {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      });
    }
  },
};

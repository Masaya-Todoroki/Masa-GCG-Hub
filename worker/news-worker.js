// Gundam Card Game news: public Nitter RSS -> JSON.
// Deploy this file to your existing Cloudflare Worker.
const HANDLES = { ENG: 'GUNDAM_GCG_ENG', JP: 'GUNDAM_GCG_JP' };
const NITTER_INSTANCES = ['https://nitter.mie.foundation', 'https://nitter.mizuki.st'];
const MAX_POSTS = 20;
const CACHE_SECONDS = 1800;
const STALE_SECONDS = 7 * 24 * 60 * 60;
const ALLOWED_ORIGIN = '*';

function clean(html) {
  return html.replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const unCdata = s => s.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
const rssTag = (block, name) => {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return m ? unCdata(m[1]) : '';
};
function xImages(descriptionHtml) {
  const out = [];
  for (const m of descriptionHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const after = m[1].replace(/&amp;/g, '&').split('/pic/')[1];
    if (!after) continue;
    let decoded;
    try { decoded = decodeURIComponent(after.replace(/^orig\//, '')); } catch { continue; }
    if (!/^(media|ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\//.test(decoded)) continue;
    const base = 'https://pbs.twimg.com/' + decoded.split('?')[0];
    if (!out.some(img => img.full === base + '?name=large')) {
      out.push({ thumb: base + '?name=small', full: base + '?name=large' });
    }
  }
  return out;
}
export function parseRss(xml, handle) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < MAX_POSTS) {
    const block = m[1];
    const title = clean(rssTag(block, 'title'));
    if (/^(RT by|R to) /.test(title)) continue;
    const id = (rssTag(block, 'link').match(/status\/(\d+)/) || [])[1];
    if (!id) continue;
    const desc = rssTag(block, 'description');
    const when = new Date(rssTag(block, 'pubDate'));
    items.push({
      title: (title || clean(desc)).slice(0, 220),
      url: `https://x.com/${handle}/status/${id}`,
      date: isNaN(when) ? '' : when.toISOString().slice(0, 10),
      category: 'X post', images: xImages(desc),
    });
  }
  return items;
}
// Extract links to individual official news articles. This parser is intentionally
// defensive: Bandai may change its HTML markup. No results => return an error,
// rather than inventing articles. Verify the live Worker after deployment.
function parseOfficialNews(html, lang) {
  const base = `https://www.gundam-gcg.com/${lang === 'JP' ? 'jp' : 'en'}/news/`;
  const items = [], seen = new Set();
  // The official listing links to /products/, /events/, and /news/ articles.
  // Only accept anchors containing a genuine publication date, rather than
  // treating navigation links and surrounding page text as announcements.
  const anchors = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchors.exec(html)) && items.length < MAX_POSTS) {
    const fragment = match[2];
    const text = clean(fragment);
    const dateMatch = text.match(/(?:20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}|20\d{2}年\s*\d{1,2}月\s*\d{1,2}日)/i);
    if (!dateMatch) continue;
    let url;
    try { url = new URL(match[1].replace(/&amp;/g, '&'), base); } catch { continue; }
    if (url.hostname !== 'www.gundam-gcg.com') continue;
    if (!/^\/(en|jp)\/(news|products|events|campaign|rules)\//i.test(url.pathname)) continue;
    if (url.pathname.replace(/\/+$/, '') === base.replace(/\/+$/, '')) continue;
    if (seen.has(url.href)) continue;
    const title = text.replace(dateMatch[0], ' ').replace(/\bLEARN MORE\b/gi, ' ').replace(/詳しくはこちら/g, ' ').replace(/\s+/g, ' ').trim();
    if (title.length < 5 || title.length > 250) continue;
    const date = new Date(dateMatch[0]);
    const normalizedDate = Number.isNaN(date.getTime()) ? dateMatch[0].replace(/\./g, '-') : date.toISOString().slice(0, 10);
    const imgMatch = fragment.match(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["']/i);
    let images = [];
    if (imgMatch) {
      try {
        const imageUrl = new URL(imgMatch[1].replace(/&amp;/g, '&'), base);
        if (imageUrl.protocol === 'https:' && !/logo|icon|arrow/i.test(imageUrl.pathname)) images = [{ thumb: imageUrl.href, full: imageUrl.href }];
      } catch {}
    }
    seen.add(url.href);
    items.push({ title: title.slice(0, 220), url: url.href, date: normalizedDate, category: 'Official website', images });
  }
  return items;
}

export default {
  async fetch(request, env, ctx) {
    const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN };
    const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors, 'Content-Type': 'application/json', ...extra },
    });
    if (request.method === 'OPTIONS') return new Response(null, {
      headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'X-GCG-Admin-Token, X-GCG-Force-Refresh' },
    });
    const lang = (new URL(request.url).searchParams.get('lang') || 'ENG').toUpperCase();
    const handle = HANDLES[lang];
    const source = (new URL(request.url).searchParams.get('source') || 'x').toLowerCase();
    if (!['x','website'].includes(source)) return json({error:'source must be x or website'},400);
    if (!handle) return json({ error: 'lang must be ENG or JP' }, 400);

    const forceRequested = request.headers.get('X-GCG-Force-Refresh') === '1';
    const submittedToken = request.headers.get('X-GCG-Admin-Token') || '';
    // Configure ADMIN_REFRESH_TOKEN as an encrypted Worker secret in Cloudflare.
    if (forceRequested && (!env.ADMIN_REFRESH_TOKEN || submittedToken !== env.ADMIN_REFRESH_TOKEN)) {
      return json({ error: 'Unauthorized refresh' }, 403);
    }
    const force = forceRequested;
    const cache = caches.default;
    const freshKey = new Request(`https://news-cache.local/gcg5/${source}/fresh/${lang}`);
    const backupKey = new Request(`https://news-cache.local/gcg5/${source}/backup/${lang}`);
    const fresh = await cache.match(freshKey);
    if (fresh && !force) return new Response(fresh.body, {
      headers: { ...cors, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });

    if (source === 'website') {
      try {
        const page = `https://www.gundam-gcg.com/${lang === 'JP' ? 'jp' : 'en'}/news/`;
        const response = await fetch(page, {signal:AbortSignal.timeout(10000),headers:{'Accept':'text/html'}});
        if (response.ok) {
          const items = parseOfficialNews(await response.text(),lang);
          if (items.length) {
            const body = JSON.stringify({lang,source:page,updated:new Date().toISOString(),items});
            ctx.waitUntil(Promise.all([
              cache.put(freshKey,new Response(body,{headers:{'Cache-Control':`max-age=${CACHE_SECONDS}`}})),
              cache.put(backupKey,new Response(body,{headers:{'Cache-Control':`max-age=${STALE_SECONDS}`}})),
            ]));
            return new Response(body,{headers:{...cors,'Content-Type':'application/json','X-Cache':'MISS'}});
          }
        }
      } catch(err) { console.warn('Official website unavailable:',String(err)); }
      const backup = await cache.match(backupKey);
      if (backup && !force) return json({...await backup.json(),stale:true},200,{'X-Cache':'STALE'});
      return json({error:'Official website news unavailable; check Worker parsing against current markup'},502);
    }

    for (const instance of NITTER_INSTANCES) {
      try {
        const res = await fetch(`${instance}/${handle}/rss`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GCGHubNews/1.0)', 'Accept': 'application/rss+xml, text/xml' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const items = parseRss(await res.text(), handle);
        if (!items.length) continue;
        const body = JSON.stringify({ lang, source: `${instance}/${handle}`, updated: new Date().toISOString(), items });
        ctx.waitUntil(Promise.all([
          cache.put(freshKey, new Response(body, { headers: { 'Cache-Control': `max-age=${CACHE_SECONDS}` } })),
          cache.put(backupKey, new Response(body, { headers: { 'Cache-Control': `max-age=${STALE_SECONDS}` } })),
        ]));
        return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json', 'X-Cache': 'MISS' } });
      } catch (err) { console.warn('RSS mirror unavailable:', instance, String(err)); }
    }

    // If mirrors fail, return the last successful result from this Cloudflare data centre.
    const backup = await cache.match(backupKey);
    if (backup && !force) {
      const payload = await backup.json();
      return json({ ...payload, stale: true }, 200, { 'X-Cache': 'STALE' });
    }
    return json({ error: 'No X mirror is reachable and no cached feed is available' }, 502);
  },
};

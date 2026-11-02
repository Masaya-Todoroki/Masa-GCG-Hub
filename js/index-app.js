        // Tab switching. To add a tab: add a button with data-tab="your-id"
        // and a matching <div id="your-id" class="tab-content">...</div>.
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                button.classList.add('active');
                document.getElementById(button.dataset.tab).classList.add('active');
            });
        });
    

// News: loaded from the Cloudflare Worker (worker/news-worker.js).
// After deploying the Worker, paste its URL here:
const NEWS_API_URL = 'https://gcg-news.masayatodoroki.workers.dev/';

// How many posts to show (the Worker provides up to 20).
const NEWS_MAX_ITEMS = 10;

const newsAccounts = { ENG: 'English', JP: 'Japanese' };
let activeNewsAccount = 'ENG';
let activeNewsSource = 'x';
let newsAttempted = false;
let newsRenderToken = 0;
const newsCache = {};
const newsPending = {};

function formatNewsDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function openLightbox(src) {
    let box = document.getElementById('news-lightbox');
    if (!box) {
        box = document.createElement('div');
        box.id = 'news-lightbox';
        box.appendChild(document.createElement('img'));
        box.addEventListener('click', () => { box.hidden = true; });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') box.hidden = true; });
        document.body.appendChild(box);
    }
    box.firstChild.src = src;
    box.hidden = false;
}

function renderNewsItems(items) {
    const holder = document.getElementById('news-timeline');
    holder.replaceChildren();
    const list = document.createElement('ul');
    list.className = 'news-list';
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'news-item';
        const images = Array.isArray(item.images) ? item.images : [];
        if (images.length) {
            const gallery = document.createElement('div');
            gallery.className = 'news-image-gallery';
            if (images.length === 1) gallery.classList.add('single-image');
            images.forEach((image, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'news-thumb-btn';
                button.setAttribute('aria-label', `View image ${index + 1} of ${images.length}`);
                const img = document.createElement('img');
                img.className = 'news-thumb';
                img.src = image.thumb || image.full;
                img.alt = `Post image ${index + 1}`;
                img.loading = 'lazy';
                img.referrerPolicy = 'no-referrer';
                img.addEventListener('error', () => button.remove());
                button.appendChild(img);
                button.addEventListener('click', () => openLightbox(image.full || image.thumb));
                gallery.appendChild(button);
            });
            li.appendChild(gallery);
        }
        const link = document.createElement('a');
        link.className = 'news-link';
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const meta = document.createElement('span');
        meta.className = 'news-meta';
        meta.textContent = `${formatNewsDate(item.date)} · ${item.category}`;
        const title = document.createElement('span');
        title.className = 'news-title';
        title.textContent = item.title;
        link.append(meta, title);
        li.appendChild(link);
        list.appendChild(li);
    });
    holder.appendChild(list);
}

async function fetchNews(account, source, force = false, adminToken = '') {
    const cacheKey = `${source}:${account}`;
    if (force) {
        const res = await fetch(`${NEWS_API_URL}?lang=${account}&source=${source}`, {
            headers: { 'X-GCG-Admin-Token': adminToken, 'X-GCG-Force-Refresh': '1' },
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`Force refresh failed (${res.status})`);
        const payload = await res.json();
        newsCache[cacheKey] = payload.items;
        return payload.items;
    }
    if (newsCache[cacheKey]) return newsCache[cacheKey];
    if (!newsPending[cacheKey]) {
        newsPending[cacheKey] = (async () => {
            const res = await fetch(`${NEWS_API_URL}?lang=${account}&source=${source}`);
            if (!res.ok) throw new Error(`News API returned ${res.status}`);
            const payload = await res.json();
            newsCache[cacheKey] = payload.items;
            return payload.items;
        })().finally(() => { delete newsPending[cacheKey]; });
    }
    return newsPending[cacheKey];
}

// Warm both X feeds as soon as the homepage loads, without delaying the page.
Promise.allSettled([
    fetchNews('ENG', 'x'),
    fetchNews('JP', 'x')
]);

async function loadNews() {
    newsAttempted = true;
    const token = ++newsRenderToken;
    const account = activeNewsAccount;
    const source = activeNewsSource;
    const status = document.getElementById('news-loading');
    document.getElementById('news-timeline').replaceChildren();
    status.hidden = false;
    status.textContent = `Loading ${newsAccounts[account]} ${source === "x" ? "X posts" : "website news"}…`;
    try {
        const items = await fetchNews(account, source);
        if (token !== newsRenderToken) return;
        renderNewsItems(items.slice(0, NEWS_MAX_ITEMS));
        status.hidden = true;
    } catch (error) {
        if (token !== newsRenderToken) return;
        status.hidden = false;
        status.textContent = 'News is temporarily unavailable. Please try again later.';
        console.warn('X posts unavailable:', error);
    }
}

document.querySelectorAll('.news-lang-btn').forEach(button => {
    button.addEventListener('click', () => {
        if (button.dataset.account === activeNewsAccount) return;
        activeNewsAccount = button.dataset.account;
        document.querySelectorAll('.news-lang-btn').forEach(btn => {
            const selected = btn === button;
            btn.classList.toggle('active', selected);
            btn.setAttribute('aria-pressed', String(selected));
        });
        if (document.getElementById('news').classList.contains('active')) loadNews();
    });
});
document.querySelector('[data-tab="news"]')?.addEventListener('click', () => {
    if (!newsAttempted) loadNews();
});

document.querySelectorAll('.news-source-btn').forEach(button => {
    button.addEventListener('click', () => {
        if (button.dataset.source === activeNewsSource) return;
        activeNewsSource = button.dataset.source;
        document.querySelectorAll('.news-source-btn').forEach(btn => {
            const selected = btn === button;
            btn.classList.toggle('active', selected);
            btn.setAttribute('aria-pressed', String(selected));
        });
        if (document.getElementById('news').classList.contains('active')) loadNews();
    });
});

// Secret admin control: hold the News heading for 3 seconds (mouse or touch).
// Hiding a button is not security: the Worker validates the secret on every refresh.
(() => {
    const heading = document.getElementById('news-admin-trigger');
    const controls = document.getElementById('news-admin-controls');
    const button = document.getElementById('news-force-refresh');
    const status = document.getElementById('news-admin-status');
    if (!heading || !controls || !button || !status) return;
    let holdTimer = null;
    let adminToken = '';
    const cancelHold = () => { if (holdTimer !== null) clearTimeout(holdTimer); holdTimer = null; };
    heading.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        cancelHold();
        holdTimer = setTimeout(() => {
            holdTimer = null;
            controls.hidden = !controls.hidden;
            status.textContent = '';
        }, 3000);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(name => heading.addEventListener(name, cancelHold));
    heading.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('click', async () => {
        if (!adminToken) {
            adminToken = window.prompt('Enter your Cloudflare admin refresh token:') || '';
            if (!adminToken) return;
        }
        const account = activeNewsAccount;
        const source = activeNewsSource;
        button.disabled = true;
        status.textContent = 'Refreshing…';
        try {
            const items = await fetchNews(account, source, true, adminToken);
            if (activeNewsAccount === account && activeNewsSource === source) {
                ++newsRenderToken;
                renderNewsItems(items.slice(0, NEWS_MAX_ITEMS));
                document.getElementById('news-loading').hidden = true;
            }
            status.textContent = 'Updated!';
        } catch (err) {
            adminToken = ''; // Re-prompt next time if token was incorrect.
            status.textContent = 'Refresh failed. Check token or feed availability.';
            console.warn('Admin refresh failed:', err);
        } finally {
            button.disabled = false;
        }
    });
})();

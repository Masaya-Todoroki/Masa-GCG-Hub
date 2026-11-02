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

async function fetchNews(account, source) {
    const cacheKey = `${source}:${account}`;
    if (!newsCache[cacheKey]) {
        const res = await fetch(`${NEWS_API_URL}?lang=${account}&source=${source}`);
        if (!res.ok) throw new Error(`News API returned ${res.status}`);
        newsCache[cacheKey] = (await res.json()).items;
    }
    return newsCache[cacheKey];
}

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

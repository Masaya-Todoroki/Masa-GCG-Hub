/* =====================================================================
   GCG JAVASCRIPT — js/home-latest-news.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
// Uses the same Cloudflare Worker and cache as the existing News tab.
(() => {
    const holder = document.getElementById('homepage-latest-news');
    if (!holder)
        return;
    const openWebsiteNews = () => {
        document.querySelector('[data-tab="news"]')?.click();
        document.querySelector('.news-lang-btn[data-account="ENG"]')?.click();
        document.querySelector('.news-source-btn[data-source="website"]')?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.getElementById('homepage-view-all-news')?.addEventListener('click', openWebsiteNews);
    const dateLabel = value => {
        if (!value)
            return 'Official website';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Official website' : date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const showMessage = msg => {
        const p = document.createElement('p');
        p.className = 'updates-loading';
        p.textContent = msg;
        holder.replaceChildren(p);
    };
    async function populate() {
        try {
            if (typeof fetchNews !== 'function')
                throw new Error('News feed unavailable');
            const items = await fetchNews('ENG', 'website');
            if (!Array.isArray(items))
                throw new Error('Invalid news feed');
            const top = items.filter(item => item && item.title && /^https?:\/\//i.test(item.url || ''))
                .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 3);
            if (!top.length) {
                showMessage('No website updates available yet.');
                return;
            }
            holder.replaceChildren();
            top.forEach(item => {
                const row = document.createElement('div');
                row.className = 'update-row';
                const link = document.createElement('a');
                link.href = item.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                const tag = document.createElement('span');
                tag.className = 'update-label';
                tag.textContent = 'GCG';
                const content = document.createElement('div');
                content.className = 'update-text';
                const title = document.createElement('strong');
                title.textContent = item.title;
                title.title = item.title;
                const date = document.createElement('small');
                date.textContent = dateLabel(item.date);
                content.append(title, date);
                const arrow = document.createElement('span');
                arrow.className = 'news-arrow';
                arrow.textContent = '›';
                arrow.setAttribute('aria-hidden', 'true');
                link.append(tag, content, arrow);
                row.append(link);
                holder.append(row);
            });
        }
        catch (err) {
            console.warn('Homepage latest news:', err);
            showMessage('Latest updates temporarily unavailable.');
        }
    }
    populate();
})();

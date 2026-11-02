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
    

// Official X feeds: fail gracefully when third-party widgets are blocked.
const newsAccounts = { ENG: 'English', JP: 'Japanese' };
let activeNewsAccount = 'ENG';
let newsScriptPromise;
let newsRenderToken = 0;
let newsAttempted = false;

function xWidgetReady() {
    return Boolean(window.twttr && window.twttr.widgets && window.twttr.widgets.createTimeline);
}
function ensureXWidgets() {
    if (xWidgetReady()) return Promise.resolve();
    if (!newsScriptPromise) {
        newsScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.onload = () => {
                if (xWidgetReady()) resolve();
                else if (window.twttr && typeof window.twttr.ready === 'function') {
                    window.twttr.ready(() => xWidgetReady() ? resolve() : reject(new Error('X widget API unavailable')));
                } else reject(new Error('X widget API unavailable'));
            };
            script.onerror = () => reject(new Error('X widget script blocked'));
            document.head.appendChild(script);
        }).catch(error => { newsScriptPromise = undefined; throw error; });
    }
    return newsScriptPromise;
}
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('X feed timed out')), ms))
    ]);
}
async function renderNewsTimeline() {
    newsAttempted = true;
    const token = ++newsRenderToken;
    const account = activeNewsAccount;
    const holder = document.getElementById('news-timeline');
    const status = document.getElementById('news-loading');
    holder.replaceChildren();
    status.hidden = false;
    status.textContent = `Loading ${newsAccounts[account]} posts…`;
    try {
        await withTimeout(ensureXWidgets(), 8000);
        if (token !== newsRenderToken) return;
        await withTimeout(window.twttr.widgets.createTimeline(
            { sourceType: 'profile', screenName: `GUNDAM_GCG_${account}` },
            holder,
            { theme: 'dark', height: 600, chrome: 'noheader nofooter' }
        ), 10000);
        if (token !== newsRenderToken) return;
        if (!holder.querySelector('iframe')) throw new Error('X did not return a timeline');
        status.hidden = true;
    } catch (error) {
        if (token !== newsRenderToken) return;
        holder.replaceChildren();
        status.hidden = false;
        status.textContent = 'X is not displaying the embedded timeline. You can open the official account using the link above.';
        console.warn('X timeline unavailable:', error);
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
        const link = document.getElementById('news-account-link');
        link.href = `https://x.com/GUNDAM_GCG_${activeNewsAccount}`;
        link.textContent = `Open ${newsAccounts[activeNewsAccount]} X account`;
        if (document.getElementById('news').classList.contains('active')) renderNewsTimeline();
    });
});
document.querySelector('[data-tab="news"]')?.addEventListener('click', () => {
    if (!newsAttempted) renderNewsTimeline();
});

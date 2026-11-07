// Set Explorer configuration: add new sets here, newest first.
// collapsed / expanded are horizontal image positions (0 = left, 50 = centre, 100 = right).
const BOOSTER_SETS = [
  { id: 'GD07', collapsed: 78, expanded: 75 },
  { id: 'GD06', collapsed: 88, expanded: 75 },
  { id: 'GD05', collapsed: 70, expanded: 50 },
  { id: 'EB01', collapsed: 70, expanded: 75 },
  { id: 'GD04', collapsed: 75, expanded: 75 },
  { id: 'GD03', collapsed: 70, expanded: 65 },
  { id: 'GD02', collapsed: 88, expanded: 75 },
  { id: 'GD01', collapsed: 88, expanded: 75 }
];

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


// Angled set browser: full-art expansion, links and mouse drag scrolling.
(() => {
  const explorer = document.querySelector('.set-explorer');
  if (!explorer) return;
  const track = document.getElementById('set-explorer-track');
  const scroller = document.getElementById('set-explorer-scroll');
  const options = document.getElementById('set-selected-options');
  const title = document.getElementById('set-selected-title');
  const links = document.getElementById('set-selected-links');
  // Build the carousel from the configuration before attaching event handlers.
  track.replaceChildren();
  BOOSTER_SETS.forEach(set => {
    const panel = document.createElement('button');
    panel.type = 'button';
    panel.className = 'set-art-panel';
    panel.dataset.set = set.id;
    panel.setAttribute('aria-label', `View ${set.id} options`);
    const collapsed = Math.max(0, Math.min(100, Number(set.collapsed) || 0));
    const expanded = Math.max(0, Math.min(100, Number(set.expanded) || 0));
    panel.style.setProperty('--set-collapsed-position', `${collapsed}% center`);
    panel.style.setProperty('--set-expanded-position', `${expanded}% center`);
    const img = document.createElement('img');
    img.src = `images/SetThumbnails/${encodeURIComponent(set.id)}.webp`;
    img.alt = `${set.id} key art`;
    img.loading = 'lazy';
    img.draggable = false;
    const label = document.createElement('span');
    label.textContent = set.id;
    panel.append(img, label);
    track.appendChild(panel);
  });
  const panels = [...track.querySelectorAll('.set-art-panel')];
  const actions = [['Reveal List', 'gdreveals.html'], ['AA-SP', 'gdaasp.html'], ['AA Pairings', 'GCG-AAPairings.html']];
  let selected = null;
  let savedScroll = 0;
  let returning = false;
  let expanding = false;
  let selectedPanel = null;
  const reset = () => {
    if (returning || !selectedPanel) return;
    returning = true;
    const panel = selectedPanel;
    const start = panel.getBoundingClientRect();
    const img = panel.querySelector('img');
    // A temporary copy travels back to the exact original panel position.
    // The real strip can be restored behind it without geometry jumps.
    const ghost = document.createElement('div');
    ghost.className = 'set-return-ghost';
    const ghostImg = img.cloneNode(true);
    ghost.appendChild(ghostImg);
    Object.assign(ghost.style, {position:'fixed',left:`${start.left}px`,top:`${start.top}px`,width:`${start.width}px`,height:`${start.height}px`,zIndex:'9999',pointerEvents:'none',overflow:'hidden',clipPath:'polygon(0 0,100% 0,100% 100%,0 100%)'});
    document.body.appendChild(ghost);
    options.hidden = true;
    options.style.removeProperty('opacity');
    explorer.classList.add('is-restoring','is-returning-position');
    explorer.classList.remove('is-selected');
    panels.forEach(p => { p.classList.remove('is-active'); p.setAttribute('aria-pressed','false'); });
    selected = null;
    selectedPanel = null;
    const oldScrollBehavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = 'auto';
    scroller.scrollLeft = savedScroll;
    // Force layout so the destination is measured after the original strip returns.
    const target = panel.getBoundingClientRect();
    // Match the actual collapsed panel's image framing, not just its outer mask.
    const finalImageStyle = getComputedStyle(img);
    const finalClip = getComputedStyle(panel).clipPath;
    const finalPosition = finalImageStyle.objectPosition;
    const finalTransform = finalImageStyle.transform === 'none' ? 'none' : finalImageStyle.transform;
    ghostImg.style.objectPosition = getComputedStyle(panel).getPropertyValue('--set-expanded-position').trim() || '75% center';
    ghostImg.style.transform = 'none';
    ghostImg.style.transformOrigin = 'center center';
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 440;
    const motion = ghost.animate([
      {left:`${start.left}px`,top:`${start.top}px`,width:`${start.width}px`,height:`${start.height}px`,clipPath:'polygon(0 0,100% 0,100% 100%,0 100%)',opacity:1},
      {left:`${target.left}px`,top:`${target.top}px`,width:`${target.width}px`,height:`${target.height}px`,clipPath:finalClip,opacity:1}
    ], {duration,easing:'cubic-bezier(.2,.75,.2,1)',fill:'forwards'});
    const imageMotion = ghostImg.animate([
      {objectPosition:getComputedStyle(panel).getPropertyValue('--set-expanded-position').trim() || '75% center',transform:'none'},
      {objectPosition:finalPosition,transform:finalTransform}
    ], {duration,easing:'cubic-bezier(.2,.75,.2,1)',fill:'forwards'});
    const reveal = scroller.animate([{opacity:0},{opacity:1}],{duration,easing:'ease-out',fill:'forwards'});
    Promise.allSettled([motion.finished,imageMotion.finished,reveal.finished]).then(() => {
      ghost.remove();
      motion.cancel(); imageMotion.cancel(); reveal.cancel();
      explorer.classList.remove('is-returning-position','is-restoring');
      scroller.style.scrollBehavior = oldScrollBehavior;
      returning = false;
    });
  };
  panels.forEach(panel => {
    panel.setAttribute('aria-pressed','false');
    panel.querySelector('img')?.setAttribute('draggable','false');
    panel.addEventListener('click', () => {
      if (suppressClick || returning || expanding) return;
      const id = panel.dataset.set;
      if (selected === id) { reset(); return; }
      savedScroll = scroller.scrollLeft;
      expanding = true;
      // Capture the clicked panel and its actual collapsed artwork framing.
      const start = panel.getBoundingClientRect();
      const originalImage = panel.querySelector('img');
      const imageStyle = getComputedStyle(originalImage);
      const startClip = getComputedStyle(panel).clipPath;
      const startPosition = imageStyle.objectPosition;
      const startTransform = imageStyle.transform === 'none' ? 'none' : imageStyle.transform;
      // Clone the rendered panel, not just the image: preserve its initial
      // artwork, label, tint and mask for a seamless shared-element handoff.
      const ghost = panel.cloneNode(true);
      ghost.className = 'set-return-ghost set-expand-ghost';
      ghost.removeAttribute('id');
      ghost.removeAttribute('aria-pressed');
      const ghostImg = ghost.querySelector('img');
      const ghostLabel = ghost.querySelector('span');
      if (ghostLabel) ghostLabel.remove();
      Object.assign(ghost.style, {
        position:'fixed', left:`${start.left}px`, top:`${start.top}px`,
        width:`${start.width}px`, height:`${start.height}px`,
        zIndex:'10001', pointerEvents:'none', overflow:'hidden', clipPath:startClip,
        display:'block', margin:'0', padding:'0', border:'0', boxSizing:'border-box',
        opacity:'1', transform:'none', filter:getComputedStyle(panel).filter,
        transition:'none', isolation:'isolate'
      });
      ghostImg.style.position = 'absolute';
      ghostImg.style.inset = '0';
      ghostImg.style.width = '100%';
      ghostImg.style.height = '100%';
      ghostImg.style.objectFit = imageStyle.objectFit;
      ghostImg.style.transition = 'none';
      ghostImg.style.objectPosition = startPosition;
      ghostImg.style.transform = startTransform;
      ghostImg.style.transformOrigin = 'center center';
      document.body.appendChild(ghost);
      // Keep the original visible until the overlay has been painted.
      ghost.getBoundingClientRect();
      selected = id;
      selectedPanel = panel;
      const art = panel.querySelector('img');
      const updateRatio = () => {
        if (art && art.naturalWidth && art.naturalHeight) {
          panel.style.setProperty('--selected-art-ratio', `${art.naturalWidth} / ${art.naturalHeight}`);
        }
      };
      updateRatio();
      if (art && !art.complete) art.addEventListener('load', updateRatio, {once:true});
      title.textContent = id;
      links.replaceChildren();
      actions.forEach(([name,page]) => {
        const a = document.createElement('a');
        a.className = 'btn'; a.href = `${page}?set=${encodeURIComponent(id)}`;
        a.textContent = name; links.appendChild(a);
      });
      panels.forEach(p => { p.classList.toggle('is-active',p === panel); p.setAttribute('aria-pressed',String(p === panel)); });
      explorer.classList.add('is-selected', 'is-expanding-position');
      options.hidden = true;
      const oldScrollBehavior = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = 'auto';
      scroller.scrollLeft = 0;
      // The destination is the visible viewport, NOT the active flex item:
      // during the layout switch that item can temporarily report its old size.
      // Using the viewport gives a stable, real large endpoint on every click.
      const destination = scroller.getBoundingClientRect();
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480;
      const easing = 'cubic-bezier(.2,.75,.2,1)';
      const fullClip = 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)';
      // Do not allow the original panel's CSS transition to interfere with the
      // geometry measured for the overlay. The clone alone owns the movement.
      ghost.style.left = `${start.left}px`;
      ghost.style.top = `${start.top}px`;
      ghost.style.width = `${start.width}px`;
      ghost.style.height = `${start.height}px`;
      ghost.style.clipPath = startClip;
      ghostImg.style.objectPosition = startPosition;
      ghostImg.style.transform = startTransform;
      // Read the editable CSS percentages and convert them to WAAPI offsets.
      const fadeStyle = getComputedStyle(document.documentElement);
      const asFraction = (value, fallback) => {
        const n = parseFloat(value);
        return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : fallback;
      };
      const fadeStart = asFraction(fadeStyle.getPropertyValue('--booster-fade-start'), .25);
      const fadeFull = Math.max(fadeStart + .001, asFraction(fadeStyle.getPropertyValue('--booster-fade-full'), .75));
      let optionsMotion;
      let floatingOptions = null;
      const finish = () => {
        // First reveal the real panel and real controls BEHIND the two floating
        // layers. Keep both floating layers fully visible while the real panel
        // has a chance to paint; nothing disappears during this step.
        scroller.style.transition = 'none';
        explorer.classList.remove('is-expanding-position');
        scroller.style.opacity = '1';
        options.hidden = false;
        options.style.opacity = '1';
        if (optionsMotion) {
          optionsMotion.finish();
          optionsMotion.cancel();
        }
        if (floatingOptions) floatingOptions.style.opacity = '1';

        // Two frames allow the real artwork/buttons to be composited beneath
        // the temporary ones before any overlay starts to disappear.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const artHandoff = ghost.animate(
            [{opacity:1}, {opacity:0}],
            {duration:reduced ? 0 : 110, easing:'ease-in-out', fill:'forwards'}
          );
          Promise.resolve(artHandoff.finished).catch(() => {}).then(() => {
            ghost.remove();
            // Floating controls stay ABOVE the art during its entire fade.
            // Now dissolve them onto the already-visible real controls.
            const controlsHandoff = floatingOptions?.animate(
              [{opacity:1}, {opacity:0}],
              {duration:reduced ? 0 : 100, easing:'ease-in-out', fill:'forwards'}
            );
            Promise.resolve(controlsHandoff?.finished).catch(() => {}).then(() => {
              floatingOptions?.remove();
              scroller.style.removeProperty('opacity');
              scroller.style.removeProperty('transition');
              scroller.style.scrollBehavior = oldScrollBehavior;
              expanding = false;
            });
          });
        }));
      };
      // Paint the small clone at its source position first. Then run a single
      // animation whose endpoints are the saved source and the real viewport.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        // Animate a viewport-positioned copy ABOVE the moving artwork. The
        // original controls remain invisible until the handoff completes.
        options.hidden = false;
        const optionsRect = options.getBoundingClientRect();
        floatingOptions = options.cloneNode(true);
        floatingOptions.removeAttribute('id');
        floatingOptions.querySelector('[id="set-selected-links"]')?.removeAttribute('id');
        // Match the final controls' resolved styles, including mobile-only
        // selectors that no longer match when the clone lives under <body>.
        // This prevents a font/padding/gap jump at the overlay handoff.
        const originalNodes = [options, ...options.querySelectorAll('*')];
        const floatingNodes = [floatingOptions, ...floatingOptions.querySelectorAll('*')];
        const copyProperties = [
          'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
          'letter-spacing', 'text-transform', 'text-align', 'white-space',
          'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
          'gap', 'row-gap', 'column-gap', 'border-radius', 'box-sizing'
        ];
        originalNodes.forEach((source, index) => {
          const target = floatingNodes[index];
          if (!target) return;
          const resolved = getComputedStyle(source);
          copyProperties.forEach(property => {
            target.style.setProperty(property, resolved.getPropertyValue(property));
          });
        });
        Object.assign(floatingOptions.style, {
          position:'fixed', left:`${optionsRect.left}px`, top:`${optionsRect.top}px`,
          width:`${optionsRect.width}px`, height:`${optionsRect.height}px`,
          transform:'none', margin:'0', zIndex:'10002', opacity:'0',
          pointerEvents:'none', visibility:'visible'
        });
        document.body.appendChild(floatingOptions);
        options.style.opacity = '0';
        optionsMotion = floatingOptions.animate([
          {opacity:0, offset:0},
          {opacity:0, offset:fadeStart},
          {opacity:1, offset:Math.min(1,fadeFull)},
          {opacity:1, offset:1}
        ], {duration, easing:'linear', fill:'forwards'});
        const motion = ghost.animate([
          {left:`${start.left}px`,top:`${start.top}px`,width:`${start.width}px`,height:`${start.height}px`,clipPath:startClip},
          {left:`${destination.left}px`,top:`${destination.top}px`,width:`${destination.width}px`,height:`${destination.height}px`,clipPath:fullClip}
        ],{duration,easing,fill:'forwards'});
        const imageMotion = ghostImg.animate([
          {objectPosition:startPosition,transform:startTransform},
          {objectPosition:getComputedStyle(panel).getPropertyValue('--set-expanded-position').trim() || '75% center',transform:'none'}
        ],{duration,easing,fill:'forwards'});
        Promise.allSettled([motion.finished,imageMotion.finished]).then(finish);
      }));
    });
  });
  let drag = null, suppressClick = false;
  scroller.addEventListener('pointerdown', e => {
    if (selected || e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = {x:e.clientX,scroll:scroller.scrollLeft,moved:false};
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) {
      if (!drag.moved) { drag.moved = true; scroller.classList.add('is-dragging'); }
      scroller.scrollLeft = drag.scroll - dx;
    }
  });
  const stopDrag = () => {
    if (!drag) return;
    if (drag.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 80); }
    drag = null; scroller.classList.remove('is-dragging');
  };
  window.addEventListener('pointerup',stopDrag);
  window.addEventListener('pointercancel',stopDrag);
  scroller.addEventListener('dragstart',e => e.preventDefault());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) reset(); });
})();

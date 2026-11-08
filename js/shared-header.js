/* =====================================================================
   MASA'S GCG HUB — SHARED HEADER
   Edit these settings to update every public page at once.
   ===================================================================== */
const SHARED_HEADER_CONFIG = {
  logoSrc: 'images/Branding/logo.png',
  homeUrl: 'index.html',
  cardsHomeUrl: 'index.html#cards',
  streamsUrl: 'streams.html',
  pairCreatorUrl: 'GCGPairCreator.html',
  adminUrl: 'admin.html',
  logoAlt: "Masa's GCG Hub",
  homeLabel: 'Home',
  tabs: [
    { id: 'cards', label: 'Cards' },
    { id: 'deck-builders', label: 'Deck Builders' },
    { id: 'simulators', label: 'Simulators' },
    { id: 'tools', label: 'Tools' },
    { id: 'news', label: 'News' }
  ]
};

/* Page-specific navigation remains intentional; all dimensions/branding
   and HTML are shared. This script runs at the old header position so
   existing scripts can still find the header immediately. */
(function renderSharedHeader() {
  const isDeckBuilder = /\/deckbuilder\//i.test(location.pathname);
  const prefix = isDeckBuilder ? '../' : '';
  const c = isDeckBuilder ? {
    ...SHARED_HEADER_CONFIG,
    logoSrc: prefix + SHARED_HEADER_CONFIG.logoSrc,
    homeUrl: prefix + SHARED_HEADER_CONFIG.homeUrl,
    cardsHomeUrl: prefix + SHARED_HEADER_CONFIG.cardsHomeUrl,
    streamsUrl: prefix + SHARED_HEADER_CONFIG.streamsUrl,
    pairCreatorUrl: prefix + SHARED_HEADER_CONFIG.pairCreatorUrl,
    adminUrl: prefix + SHARED_HEADER_CONFIG.adminUrl
  } : SHARED_HEADER_CONFIG;
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isHome = page === 'index.html' && !isDeckBuilder;
  const isStreams = page === 'streams.html';
  const isPromos = page === 'storepromos.html' || page === 'ex-base-resource-promos.html';
  const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const logo = `<a class="header-brand" href="${esc(c.homeUrl)}" aria-label="Masa's GCG Hub home"><img class="brand-logo" src="${esc(c.logoSrc)}" alt="${esc(c.logoAlt)}"></a>`;
  const home = `<nav class="tabs promo-home-nav" aria-label="Return to homepage"><a class="tab-btn active" href="${esc(isPromos ? c.cardsHomeUrl : c.homeUrl)}">${esc(c.homeLabel)}</a></nav>`;
  const tabs = `<nav class="tabs" aria-label="GCG Hub sections">${c.tabs.map((t, i) => `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${esc(t.id)}">${esc(t.label)}</button>`).join('')}<a class="tab-btn streams-nav nav-external" href="${esc(c.streamsUrl)}">Streams</a><a class="tab-btn streams-nav nav-admin" href="${esc(c.pairCreatorUrl)}" id="gcg-admin-pair-tab" hidden>Pair Creator</a></nav><button type="button" class="header-menu" aria-label="Toggle navigation" aria-expanded="false">☰</button>`;
  const deckStatus = isDeckBuilder ? '<span class="pill deck-header-count" id="countHeader">Loading cards…</span>' : '';
  const admin = isStreams ? `<a id="admin-link" href="${esc(c.adminUrl)}" hidden>● Admin Mode</a>` : '';
  // Preserve legacy page-specific classes for fullscreen and other existing CSS.
  const legacy = isStreams ? ' top streams-site-header' : page === 'gcg-aapairings.html' ? ' site-header' : (page === 'gdreveals.html' || page === 'gdaasp.html') ? ' showcase-header' : '';
  document.write(`<header class="hub-header shared-site-header${legacy}">${logo}${deckStatus}${isHome ? tabs : home}${admin}</header>`);
})();

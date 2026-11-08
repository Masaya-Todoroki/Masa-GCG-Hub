/* =====================================================================
   GCG JAVASCRIPT — js/promo-header.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
// Match the homepage's responsive navigation menu on standalone pages.
document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.hub-header');
    const menu = header?.querySelector('.header-menu');
    if (!header || !menu)
        return;
    menu.addEventListener('click', () => {
        const open = header.classList.toggle('menu-open');
        menu.setAttribute('aria-expanded', String(open));
    });
});

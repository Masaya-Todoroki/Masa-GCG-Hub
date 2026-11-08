/* =====================================================================
   GCG JAVASCRIPT — js/home-navigation.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
(() => {
    const nav = document.querySelector('.hub-header');
    const menu = document.querySelector('.header-menu');
    menu?.addEventListener('click', () => {
        const open = nav.classList.toggle('menu-open');
        menu.setAttribute('aria-expanded', String(open));
    });
    const activate = tab => {
        const btn = document.querySelector('.tabs button[data-tab="' + tab + '"]');
        if (btn) {
            btn.click();
            nav.classList.remove('menu-open');
            menu?.setAttribute('aria-expanded', 'false');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    document.querySelectorAll('[data-go-tab]').forEach(el => el.addEventListener('click', () => activate(el.dataset.goTab)));
    document.querySelector('.hero-explore')?.addEventListener('click', () => document.querySelector('.set-explorer-scroll')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    const scroller = document.querySelector('#set-explorer-scroll');
    const scrollByAmount = direction => scroller?.scrollBy({ left: direction * 320, behavior: 'smooth' });
    document.querySelector('.carousel-arrow-left')?.addEventListener('click', () => scrollByAmount(-1));
    document.querySelector('.carousel-arrow-right')?.addEventListener('click', () => scrollByAmount(1));
})();

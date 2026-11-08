/* =====================================================================
   GCG JAVASCRIPT — js/GCG-AAPairings-layout.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
// Preserve browser scroll when switching to a card detail and back.
(() => {
    const grid = document.getElementById('card-grid');
    const back = document.getElementById('back-button');
    const gallery = document.getElementById('gallery-view');
    const detail = document.getElementById('detail-view');
    let savedScroll = 0;
    if (grid)
        grid.addEventListener('click', (event) => {
            if (!event.target.closest('.card'))
                return;
            savedScroll = window.scrollY;
            requestAnimationFrame(() => window.scrollTo(0, 0));
        }, true);
    if (back)
        back.addEventListener('click', () => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (gallery && !gallery.classList.contains('hidden') &&
                    detail && detail.classList.contains('hidden'))
                    window.scrollTo(0, savedScroll);
            }));
        });
    const logo = document.querySelector('.site-logo');
    if (logo)
        logo.addEventListener('error', () => { logo.style.display = 'none'; });
})();
// The standalone page already has a Home button in the site header.
// Remove the redundant Home option injected by the original set navigation.
document.addEventListener('DOMContentLoaded', () => {
    const setButtons = document.getElementById('set-buttons');
    if (!setButtons)
        return;
    const removeDuplicate = () => {
        for (const child of [...setButtons.children]) {
            if (child.textContent.trim().toLowerCase() === 'home')
                child.remove();
        }
    };
    removeDuplicate();
    new MutationObserver(removeDuplicate).observe(setButtons, { childList: true });
});

/* =====================================================================
   GCG JAVASCRIPT — js/home-tab-deeplinks.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
// Navigate directly to a homepage tab from standalone gallery pages.
(function () {
    const tabs = new Set(['cards', 'deck-builders', 'simulators', 'tools', 'news']);
    function openHash() { const tab = decodeURIComponent(location.hash.slice(1)); if (!tabs.has(tab))
        return; const button = document.querySelector('.tab-btn[data-tab="' + tab + '"]'); if (button && !button.classList.contains('active'))
        button.click(); }
    window.addEventListener('DOMContentLoaded', () => { openHash(); setTimeout(openHash, 120); });
    window.addEventListener('hashchange', openHash);
})();

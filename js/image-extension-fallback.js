// Resolve image extensions automatically, preferring WebP when available.
// A failed candidate is tried with other formats before existing fallback handlers run.
(() => {
    const extensions = ["webp", "png", "jpg", "jpeg", "avif", "gif"];
    const attempts = new WeakMap();

    document.addEventListener("error", (event) => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement)) return;

        const current = img.getAttribute("src") || "";
        const match = current.match(/^(.*)\.(webp|png|jpe?g|avif|gif)([?#].*)?$/i);
        if (!match) return;

        const stem = match[1];
        const suffix = match[3] || "";
        let state = attempts.get(img);
        if (!state || state.stem !== stem || state.suffix !== suffix) {
            state = { stem, suffix, tried: new Set() };
            attempts.set(img, state);
        }
        state.tried.add(match[2].toLowerCase());
        const next = extensions.find(ext => !state.tried.has(ext));
        if (next) {
            event.stopImmediatePropagation();
            img.src = `${stem}.${next}${suffix}`;
        } else {
            attempts.delete(img);
        }
    }, true);
})();

/* =====================================================================
   GCG JAVASCRIPT — js/ex-base-resource-promos-app.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
// EX Base / EX Resource / Resource promo gallery.
// Discover images in parallel batches instead of loading every full-size image
// sequentially before showing the gallery.
const promoSets = [
    { title: "EX Base Promos", folder: "EXBP", prefix: "EXBP" },
    { title: "EX Resource Promos", folder: "EXRP", prefix: "EXRP" },
    { title: "Resource Promos", folder: "RP", prefix: "RP" }
];
const root = "images";
const extensions = ["webp", "png", "jpg", "jpeg", "avif", "gif"];
const BATCH_SIZE = 8;
const imageCache = new Map();
const pendingDiscovery = new Map();
let current = 0;
let renderRequest = 0;
const content = document.getElementById("content");
// HEAD requests check file existence without downloading the full card image.
async function imageExists(url) {
    try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.ok)
            return true;
        if (response.status !== 405 && response.status !== 501)
            return false;
    }
    catch (_) { /* Local servers may not support HEAD; try an image probe. */ }
    return new Promise(resolve => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = url;
    });
}
async function findImage(folder, id) {
    for (const extension of extensions) {
        const url = `${root}/${folder}/${id}.${extension}`;
        if (await imageExists(url))
            return url;
    }
    return null;
}
function makeCard({ id, url }, eager) {
    const card = document.createElement("div");
    card.className = "card";
    const img = document.createElement("img");
    img.src = url;
    img.alt = id;
    img.width = 500;
    img.height = 700;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    if (eager)
        img.fetchPriority = "high";
    card.appendChild(img);
    return card;
}
// One discovery process per set; results are cached when switching tabs.
function discoverImages(set, onBatch) {
    if (imageCache.has(set.folder)) {
        onBatch(imageCache.get(set.folder), true);
        return Promise.resolve();
    }
    if (pendingDiscovery.has(set.folder)) {
        const task = pendingDiscovery.get(set.folder);
        task.listeners.add(onBatch);
        onBatch(task.images, true);
        return task.promise;
    }
    const task = { images: [], listeners: new Set([onBatch]), promise: null };
    pendingDiscovery.set(set.folder, task);
    task.promise = (async () => {
        for (let start = 1;; start += BATCH_SIZE) {
            const candidates = await Promise.all(Array.from({ length: BATCH_SIZE }, (_, offset) => {
                const id = `${set.prefix}-${String(start + offset).padStart(3, "0")}`;
                return findImage(set.folder, id).then(url => url ? { id, url } : null);
            }));
            const firstMissing = candidates.findIndex(item => !item);
            const found = firstMissing === -1 ? candidates : candidates.slice(0, firstMissing);
            task.images.push(...found);
            for (const listener of task.listeners)
                listener(found, false);
            if (firstMissing !== -1) {
                console.info(`Stopped ${set.title} at ${set.prefix}-${String(start + firstMissing).padStart(3, "0")}: no image found.`);
                break;
            }
        }
        imageCache.set(set.folder, task.images);
    })().finally(() => pendingDiscovery.delete(set.folder));
    return task.promise;
}
function render() {
    const request = ++renderRequest;
    const set = promoSets[current];
    document.querySelectorAll(".tab").forEach((b, i) => b.classList.toggle("active", i === current));
    content.innerHTML = "";
    const heading = document.createElement("h2");
    heading.textContent = set.title;
    const grid = document.createElement("div");
    grid.className = "grid";
    const status = document.createElement("p");
    status.textContent = "Loading cards…";
    content.append(heading, grid, status);
    let displayed = 0;
    const onBatch = (images, fromCache) => {
        if (request !== renderRequest)
            return;
        for (const item of images)
            grid.appendChild(makeCard(item, displayed++ < 8));
        if (displayed)
            status.textContent = "";
    };
    discoverImages(set, onBatch).then(() => {
        if (request === renderRequest)
            status.textContent = displayed ? "" : "No cards found.";
    }).catch(error => {
        console.error("Unable to load promo cards", error);
        if (request === renderRequest)
            status.textContent = "Unable to load cards. Please refresh.";
    });
}
document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
        current = Number(btn.dataset.index);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
});
const viewer = document.getElementById("viewer");
const viewerImg = document.getElementById("viewerImg");
// Delegation handles cards added after the first batch.
content.addEventListener("click", event => {
    const img = event.target.closest(".card img");
    if (!img)
        return;
    viewerImg.src = img.currentSrc || img.src;
    viewer.classList.add("open");
    document.body.style.overflow = "hidden";
});
function closeViewer() {
    viewer.classList.remove("open");
    viewerImg.src = "";
    document.body.style.overflow = "";
}
document.querySelector(".close").onclick = closeViewer;
viewer.onclick = e => { if (e.target === viewer)
    closeViewer(); };
document.addEventListener("keydown", e => { if (e.key === "Escape")
    closeViewer(); });
render();

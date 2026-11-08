/* =====================================================================
   GCG JAVASCRIPT — js/gdaasp-app.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
/* ============================================
   SET CONFIGURATION — edit this list for new sets
   ============================================ */
const SET_CODES = ["GD04", "GD05", "GD06"];
const DEFAULT_SET = "GD06";
/* ============================================
   Set Selection & Automatic Navigation Buttons
   ============================================ */
const params = new URLSearchParams(window.location.search);
const requestedSet = (params.get("set") || "").toUpperCase();
const set = SET_CODES.includes(requestedSet) ? requestedSet : DEFAULT_SET;
const viewer = document.getElementById("viewer");
const image = document.getElementById("revealImage");
const toolbar = document.getElementById("toolbar");
// Build buttons in the same order as SET_CODES.
for (const code of SET_CODES) {
    const button = document.createElement("a");
    button.href = `?set=${encodeURIComponent(code)}`;
    button.className = "btn set-button";
    button.dataset.set = code;
    button.textContent = code;
    if (code === set)
        button.classList.add("current");
    toolbar.appendChild(button);
}
image.src = `/images/${set}/${set}_AASPReveal.webp`;
image.alt = `${set} AA/SP Reveal List`;
document.title = `${set} AA/SP Reveal List`;
/* =========================
   Viewer State
   ========================= */
let scale = 1;
let x = 0;
let y = 0;
let minScale = 1;
const maxScale = 12;
let pointers = new Map();
let lastPointerX = 0;
let lastPointerY = 0;
let initialPinchDistance = 0;
let initialPinchScale = 1;
let initialPinchCenterX = 0;
let initialPinchCenterY = 0;
let initialPinchImageX = 0;
let initialPinchImageY = 0;
let hasMoved = false;
let pointerStartX = 0;
let pointerStartY = 0;
/* =========================
   Transform
   ========================= */
function updateTransform() {
    image.style.transform =
        `translate(${x}px, ${y}px) scale(${scale})`;
}
/* =========================
   Fit Image
   ========================= */
function fitImage() {
    if (!image.naturalWidth ||
        !image.naturalHeight) {
        return;
    }
    const viewerWidth = viewer.clientWidth;
    const viewerHeight = viewer.clientHeight;
    const fitX = viewerWidth / image.naturalWidth;
    const fitY = viewerHeight / image.naturalHeight;
    /*
     * Fit the entire image on screen.
     */
    minScale =
        Math.min(fitX, fitY);
    scale =
        minScale;
    const displayedWidth = image.naturalWidth * scale;
    const displayedHeight = image.naturalHeight * scale;
    x =
        (viewerWidth - displayedWidth) / 2;
    y =
        (viewerHeight - displayedHeight) / 2;
    updateTransform();
    // Reveal only after the new image has been scaled and positioned.
    image.style.visibility = "visible";
}
image.addEventListener("load", fitImage);
window.addEventListener("resize", fitImage);
/* =========================
   Zoom
   ========================= */
function zoomAt(screenX, screenY, newScale) {
    newScale =
        Math.max(minScale, Math.min(maxScale, newScale));
    /*
     * Position inside the image
     * underneath the mouse/fingers.
     */
    const imageX = (screenX - x) / scale;
    const imageY = (screenY - y) / scale;
    scale =
        newScale;
    /*
     * Keep that same image position
     * underneath the cursor.
     */
    x =
        screenX - imageX * scale;
    y =
        screenY - imageY * scale;
    updateTransform();
}
/* =========================
   Mouse Wheel Zoom
   ========================= */
viewer.addEventListener("wheel", function (event) {
    event.preventDefault();
    const zoomAmount = event.deltaY < 0
        ? 1.15
        : 1 / 1.15;
    zoomAt(event.clientX, event.clientY, scale * zoomAmount);
}, {
    passive: false
});
/* =========================
   Pointer Down
   ========================= */
viewer.addEventListener("pointerdown", function (event) {
    // Let the browser handle right-click and its image context menu.
    if (event.pointerType === "mouse" && event.button !== 0)
        return;
    viewer.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
    });
    pointerStartX =
        event.clientX;
    pointerStartY =
        event.clientY;
    hasMoved =
        false;
    if (pointers.size === 1) {
        lastPointerX =
            event.clientX;
        lastPointerY =
            event.clientY;
        viewer.classList.add("dragging");
    }
    if (pointers.size === 2) {
        const points = [...pointers.values()];
        initialPinchDistance =
            getDistance(points[0], points[1]);
        initialPinchScale =
            scale;
        const center = getCenter(points[0], points[1]);
        initialPinchCenterX =
            center.x;
        initialPinchCenterY =
            center.y;
        initialPinchImageX =
            (center.x - x) / scale;
        initialPinchImageY =
            (center.y - y) / scale;
    }
});
/* =========================
   Pointer Move
   ========================= */
viewer.addEventListener("pointermove", function (event) {
    if (!pointers.has(event.pointerId)) {
        return;
    }
    pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
    });
    const moveDistance = Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY);
    if (moveDistance > 5) {
        hasMoved =
            true;
    }
    /* One finger / mouse drag */
    if (pointers.size === 1) {
        const dx = event.clientX - lastPointerX;
        const dy = event.clientY - lastPointerY;
        x += dx;
        y += dy;
        lastPointerX =
            event.clientX;
        lastPointerY =
            event.clientY;
        updateTransform();
    }
    /* Two finger pinch */
    if (pointers.size === 2) {
        const points = [...pointers.values()];
        const distance = getDistance(points[0], points[1]);
        const center = getCenter(points[0], points[1]);
        let newScale = initialPinchScale *
            (distance /
                initialPinchDistance);
        newScale =
            Math.max(minScale, Math.min(maxScale, newScale));
        scale =
            newScale;
        x =
            center.x -
                initialPinchImageX *
                    scale;
        y =
            center.y -
                initialPinchImageY *
                    scale;
        updateTransform();
    }
});
/* =========================
   Pointer Up
   ========================= */
function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) {
        viewer.classList.remove("dragging");
        /*
         * A normal click/tap,
         * without dragging,
         * toggles the toolbar.
         */
        if (!hasMoved) {
            // Controls remain visible in normal mode.
        }
    }
    if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        lastPointerX =
            remaining.x;
        lastPointerY =
            remaining.y;
    }
}
viewer.addEventListener("pointerup", endPointer);
viewer.addEventListener("pointercancel", endPointer);
/* =========================
   Double Click Reset
   ========================= */
viewer.addEventListener("dblclick", function (event) {
    event.preventDefault();
    toggleFullscreen();
});
/* =========================
   Pinch Helpers
   ========================= */
function getDistance(pointA, pointB) {
    return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}
function getCenter(pointA, pointB) {
    return {
        x: (pointA.x + pointB.x) / 2,
        y: (pointA.y + pointB.y) / 2
    };
}
/* Showcase V2: image fit and fullscreen behaviour */
const showcaseControls = document.querySelector('.showcase-controls');
const fullscreenButton = document.getElementById('fullscreenButton');
const exitFullscreenButton = document.getElementById('exitFullscreenButton');
function updateViewerBounds() {
    if (showcaseControls)
        document.documentElement.style.setProperty('--viewer-top', Math.ceil(showcaseControls.getBoundingClientRect().bottom) + 'px');
}
function refitViewer() {
    updateViewerBounds();
    requestAnimationFrame(fitImage);
}
async function toggleFullscreen() {
    const entering = !document.body.classList.contains('viewer-fullscreen');
    document.body.classList.toggle('viewer-fullscreen', entering);
    if (entering) {
        try {
            if (document.documentElement.requestFullscreen)
                await document.documentElement.requestFullscreen();
        }
        catch (e) { /* CSS fullscreen fallback */ }
    }
    else if (document.fullscreenElement) {
        try {
            await document.exitFullscreen();
        }
        catch (e) { }
    }
    requestAnimationFrame(() => requestAnimationFrame(fitImage));
}
fullscreenButton?.addEventListener('click', toggleFullscreen);
exitFullscreenButton?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('viewer-fullscreen')) {
        document.body.classList.remove('viewer-fullscreen');
        requestAnimationFrame(fitImage);
    }
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('viewer-fullscreen')) {
        document.body.classList.remove('viewer-fullscreen');
        requestAnimationFrame(fitImage);
    }
});
if ('ResizeObserver' in window && showcaseControls) {
    new ResizeObserver(() => { if (!document.body.classList.contains('viewer-fullscreen'))
        refitViewer(); }).observe(showcaseControls);
}
window.addEventListener('load', refitViewer);
updateViewerBounds();
// Cached images may already be complete before their load event is handled.
if (image.complete && image.naturalWidth)
    requestAnimationFrame(fitImage);

/* Keep the artwork fitted after the header/footer have settled. */
function syncShowcaseViewer() {
    updateViewerBounds();
    const footer = document.querySelector('.showcase-footer');
    if (footer) document.documentElement.style.setProperty('--showcase-footer-space', Math.ceil(footer.getBoundingClientRect().height) + 'px');
    requestAnimationFrame(() => requestAnimationFrame(fitImage));
}
window.addEventListener('load', syncShowcaseViewer);
window.addEventListener('resize', syncShowcaseViewer);
if ('ResizeObserver' in window) {
    const footer = document.querySelector('.showcase-footer');
    if (footer) new ResizeObserver(syncShowcaseViewer).observe(footer);
}
/* Preserve native right-click Save image as... on the actual <img>. */
image.addEventListener('contextmenu', event => event.stopPropagation());
const saveImageLink = document.getElementById('saveFullscreenImage');
if (saveImageLink) {
    const updateSaveLink = () => { saveImageLink.href = image.currentSrc || image.src; };
    image.addEventListener('load', updateSaveLink);
    updateSaveLink();
}

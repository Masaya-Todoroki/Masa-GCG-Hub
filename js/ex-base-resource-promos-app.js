        // Images are discovered in order, starting at 001 and stopping at the
        // first missing number. Add a new image without changing this file.
        const promoSets = [
            { title: "EX Base Promos", folder: "EXBP", prefix: "EXBP" },
            { title: "EX Resource Promos", folder: "EXRP", prefix: "EXRP" },
            { title: "Resource Promos", folder: "RP", prefix: "RP" }
        ];

        const root = "images";
        const extensions = ["webp", "png", "jpg", "jpeg", "avif", "gif"];
        const imageCache = new Map();
        let current = 0;
        let renderRequest = 0;
        const content = document.getElementById("content");

        // Test an image by loading it: works on GitHub Pages and local Live Server.
        function imageExists(url) {
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
                if (await imageExists(url)) return url;
            }
            return null;
        }

        async function discoverImages(set) {
            const key = set.folder;
            if (imageCache.has(key)) return imageCache.get(key);
            const images = [];
            for (let i = 1; ; i++) {
                const id = `${set.prefix}-${String(i).padStart(3, "0")}`;
                const url = await findImage(set.folder, id);
                if (!url) {
                    console.info(`Stopped ${set.title} at ${id}: no image found.`);
                    break;
                }
                images.push({ id, url });
            }
            imageCache.set(key, images);
            return images;
        }

        async function render() {
            const request = ++renderRequest;
            const set = promoSets[current];
            document.querySelectorAll(".tab").forEach((b, i) => b.classList.toggle("active", i === current));
            content.innerHTML = `<h2>${set.title}</h2><p>Loading images…</p>`;
            const images = await discoverImages(set);
            if (request !== renderRequest) return; // Ignore an old tab's result.
            const cards = images.map(({ id, url }) =>
                `<div class="card"><img src="${url}" alt="${id}" width="500" height="700" loading="lazy"></div>`
            ).join("");
            content.innerHTML = `<h2>${set.title}</h2><div class="grid">${cards}</div>`;
            attachViewer();
        }

        document.querySelectorAll(".tab").forEach(btn => {
            btn.onclick = () => {
                current = parseInt(btn.dataset.index);
                render();
                window.scrollTo({ top: 0, behavior: "smooth" });
            };
        });

        const viewer = document.getElementById("viewer");
        const viewerImg = document.getElementById("viewerImg");

        function attachViewer() {
            document.querySelectorAll(".card img").forEach(img => {
                img.onclick = () => {
                    viewerImg.src = img.src;
                    viewer.classList.add("open");
                    document.body.style.overflow = "hidden";
                };
            });
        }
        function closeViewer() {
            viewer.classList.remove("open");
            viewerImg.src = "";
            document.body.style.overflow = "";
        }
        document.querySelector(".close").onclick = closeViewer;
        viewer.onclick = e => { if (e.target === viewer) closeViewer(); };
        document.addEventListener("keydown", e => { if (e.key === "Escape") closeViewer(); });

        render();
    

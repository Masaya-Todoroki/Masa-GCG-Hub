        const promoSets = [
            { title: "EX Base Promos", folder: "EXBP", prefix: "EXBP", amount: 37 },
            { title: "EX Resource Promos", folder: "EXRP", prefix: "EXRP", amount: 24 },
            { title: "Resource Promos", folder: "RP", prefix: "RP", amount: 79 }
        ];

        const root = "images";
        let current = 0;
        const content = document.getElementById("content");

        function render() {
            const set = promoSets[current];
            let html = `<h2>${set.title}</h2><div class="grid">`;
            for (let i = 1; i <= set.amount; i++) {
                const num = String(i).padStart(3, "0");
                const id = `${set.prefix}-${num}`;
                html += `<div class="card"><img src="${root}/${set.folder}/${id}.webp" alt="${id}" width="500" height="700"></div>`;
            }
            html += "</div>";
            content.innerHTML = html;
            attachViewer();
            document.querySelectorAll(".tab").forEach((b, i) => b.classList.toggle("active", i === current));
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
    

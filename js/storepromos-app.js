        /*
        ============================================
        ONLY EDIT THIS LIST WHEN ADDING NEW SEASONS
        ============================================
        */

        const seasons = [
            "(01) 2025-season-1",
            "(02) 2025-season-2",
            "(03) 2026-season-1",
            "(04) 2026-season-2",
            "(05) 2026-season-3",
            "(06) 2026-season-4"
        ];

        /*
        ============================================
        SETTINGS
        ============================================
        */

        const cardsPerSeason = 8;

        const imageRoot = "images/store-promos";

        let selectedSeason =
            seasons[0];

        let selectedType =
            "participation";

        /*
        ============================================
        ELEMENTS
        ============================================
        */

        const seasonButtons =
            document.getElementById("seasonButtons");

        const content =
            document.getElementById("content");

        const participationButton =
            document.getElementById(
                "participationButton"
            );

        const winnerButton =
            document.getElementById(
                "winnerButton"
            );

        const imageViewer =
            document.getElementById("imageViewer");

        const viewerImage =
            document.getElementById("viewerImage");

        const viewerClose =
            document.getElementById("viewerClose");

        /*
        ============================================
        SEASON NAMES
        ============================================
        */

        function getSeasonDetails(folder) {
            const match = folder.match(
                /^(?:\(\d+\)\s*)?(\d{4})-season-(\d+)$/
            );

            if (!match) {
                return {
                    buttonName: folder,
                    fullName: folder
                };
            }

            const year = match[1];
            const season = match[2];

            return {
                buttonName: `${year} S${season}`,
                fullName:
                    `Store Tournament ${year} Season ${season}`
            };
        }

        /*
        ============================================
        CREATE CARD
        ============================================
        */

        function createCard(
            folder,
            number,
            isWinner
        ) {
            const suffix =
                isWinner ? "w" : "";

            const fileName =
                `${number}${suffix}.webp`;

            const imagePath =
                `${imageRoot}/${folder}/${fileName}`;

            const cardLabel = isWinner
                ? `${number} winner promo`
                : `${number} participation promo`;

            return `
                    <article class="promo-card">
                        <button
                            type="button"
                            class="card-image-button"
                            data-image="${imagePath}"
                            data-alt="${cardLabel}"
                            aria-label="View ${cardLabel}"
                        >
                            <img
                                src="${imagePath}"
                                alt="${cardLabel}"
                                loading="lazy"
                            >
                        </button>
                    </article>
                `;
        }

        /*
        ============================================
        CREATE CARD GRID
        ============================================
        */

        function createCardGrid() {
            let cards = "";

            const isWinner =
                selectedType === "winner";

            for (
                let i = 1;
                i <= cardsPerSeason;
                i++
            ) {
                const number =
                    String(i).padStart(3, "0");

                cards += createCard(
                    selectedSeason,
                    number,
                    isWinner
                );
            }

            return cards;
        }

        /*
        ============================================
        RENDER PAGE
        ============================================
        */

        // Eight permanent card slots. Each has two image elements (front/back).
        // Prepare the next set offscreen, then switch both layers in one paint.
        let imageSwapGeneration = 0;
        let cardSlots = [];
        let backgroundPreloadStarted = false;

        function imageFor(folder, number, type) {
            const suffix = type === "winner" ? "w" : "";
            return `${imageRoot}/${folder}/${number}${suffix}.webp`;
        }

        function ensureGrid() {
            if (cardSlots.length) return;
            content.innerHTML = `
                <h2 class="season-title"></h2>
                <h3 class="category-title"></h3>
                <div class="promo-grid"></div>
            `;
            const grid = content.querySelector(".promo-grid");
            for (let i = 0; i < cardsPerSeason; i++) {
                const article = document.createElement("article");
                article.className = "promo-card";
                const button = document.createElement("button");
                button.type = "button";
                button.className = "card-image-button swap-promo-image";
                button.setAttribute("aria-label", "View promo card");
                const images = [document.createElement("img"), document.createElement("img")];
                images.forEach((img, index) => {
                    img.className = "swap-promo-layer";
                    img.decoding = "async";
                    img.loading = "eager";
                    img.style.visibility = "hidden";
                    img.setAttribute("aria-hidden", "true");
                    button.appendChild(img);
                });
                button.addEventListener("click", () => {
                    if (button.dataset.image) openImageViewer(button.dataset.image, button.dataset.alt);
                });
                article.appendChild(button);
                grid.appendChild(article);
                cardSlots.push({ button, images, front: 0, visible: false });
            }
        }

        function selectionImages(folder, type) {
            return Array.from({ length: cardsPerSeason }, (_, i) => {
                const number = String(i + 1).padStart(3, "0");
                return {
                    src: imageFor(folder, number, type),
                    alt: `${number} ${type === "winner" ? "winner" : "participation"} promo`
                };
            });
        }

        // Image objects are decoded offscreen before their src is assigned to a visible slot.
        // Keep references alive so the browser can reuse decoded resources.
        const decodedImages = new Map();
        function preloadImage(src) {
            if (!decodedImages.has(src)) {
                decodedImages.set(src, new Promise(resolve => {
                    const image = new Image();
                    image.onload = async () => {
                        try { await image.decode(); } catch (_) {}
                        resolve(image.naturalWidth ? image : null);
                    };
                    image.onerror = () => { decodedImages.delete(src); resolve(null); };
                    image.src = src;
                }));
            }
            return decodedImages.get(src);
        }

        async function renderCards() {
            ensureGrid();
            const folder = selectedSeason;
            const type = selectedType;
            const generation = ++imageSwapGeneration;
            const details = getSeasonDetails(folder);
            const selection = selectionImages(folder, type);
            updateSeasonButtons();
            updateTypeButtons();

            // Each of the eight slots is permanent. Never clear or hide its current image.
            // On first page load, reveal each image independently as it arrives.
            // Swap each ready card independently; never blank the currently visible layer.
            // A missing winner image must not block the other seven cards.
            await Promise.all(selection.map(async (next, i) => {
                const decoded = await preloadImage(next.src);
                if (generation !== imageSwapGeneration || !decoded) return;
                const slot = cardSlots[i];
                if (slot.button.dataset.image === next.src) return;
                const backIndex = 1 - slot.front;
                const back = slot.images[backIndex];
                const front = slot.images[slot.front];
                back.src = decoded.src;
                back.alt = next.alt;
                back.style.visibility = 'visible';
                front.style.visibility = 'hidden';
                slot.front = backIndex;
                slot.visible = true;
                slot.button.dataset.image = next.src;
                slot.button.dataset.alt = next.alt;
                slot.button.setAttribute('aria-label', `View ${next.alt}`);
            }));
            if (generation !== imageSwapGeneration) return;
            content.querySelector('.season-title').textContent = details.fullName;
            content.querySelector('.category-title').textContent = type === 'winner' ? 'Winner Promos' : 'Participation Promos';

            if (!backgroundPreloadStarted) {
                backgroundPreloadStarted = true;
                // Don't compete with the initial eight card downloads.
                (async () => {
                    for (const season of seasons) {
                        for (const category of ['participation', 'winner']) {
                            if (season === folder && category === type) continue;
                            await Promise.all(selectionImages(season, category).map(item => preloadImage(item.src)));
                        }
                    }
                })();
            }
        }

        /*
        ============================================
        SEASON BUTTONS
        ============================================
        */

        function createSeasonButtons() {
            seasons.forEach(folder => {
                const details =
                    getSeasonDetails(folder);

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "nav-button season-button";

                button.dataset.folder =
                    folder;

                button.textContent =
                    details.buttonName;

                button.addEventListener(
                    "click",
                    () => {
                        selectedSeason = folder;
                        renderCards();

                    }
                );

                seasonButtons.appendChild(
                    button
                );
            });
        }

        function updateSeasonButtons() {
            document
                .querySelectorAll(
                    ".season-button"
                )
                .forEach(button => {
                    const isActive =
                        button.dataset.folder ===
                        selectedSeason;

                    button.classList.toggle(
                        "active",
                        isActive
                    );

                    button.setAttribute(
                        "aria-current",
                        isActive ? "page" : "false"
                    );
                });
        }

        /*
        ============================================
        PARTICIPATION / WINNER TOGGLE
        ============================================
        */

        function setSelectedType(type) {
            if (selectedType === type) return;
            selectedType = type;
            renderCards();
        }

        function updateTypeButtons() {
            const participationActive =
                selectedType === "participation";

            participationButton.classList.toggle(
                "active",
                participationActive
            );

            winnerButton.classList.toggle(
                "active",
                !participationActive
            );

            participationButton.setAttribute(
                "aria-pressed",
                participationActive
            );

            winnerButton.setAttribute(
                "aria-pressed",
                !participationActive
            );
        }

        participationButton.addEventListener(
            "click",
            () => {
                setSelectedType("participation");
            }
        );

        winnerButton.addEventListener(
            "click",
            () => {
                setSelectedType("winner");
            }
        );

        /*
        ============================================
        IMAGE VIEWER
        ============================================
        */

        function attachImageViewerButtons() {
            document
                .querySelectorAll(
                    ".card-image-button"
                )
                .forEach(button => {
                    button.addEventListener(
                        "click",
                        () => {
                            openImageViewer(
                                button.dataset.image,
                                button.dataset.alt
                            );
                        }
                    );
                });
        }

        function openImageViewer(
            imagePath,
            imageAlt
        ) {
            viewerImage.src = imagePath;
            viewerImage.alt = imageAlt;

            imageViewer.classList.add("open");

            imageViewer.setAttribute(
                "aria-hidden",
                "false"
            );

            document.body.style.overflow =
                "hidden";
        }

        function closeImageViewer() {
            imageViewer.classList.remove("open");

            imageViewer.setAttribute(
                "aria-hidden",
                "true"
            );

            viewerImage.src = "";
            viewerImage.alt = "";

            document.body.style.overflow = "";
        }

        viewerClose.addEventListener(
            "click",
            closeImageViewer
        );

        imageViewer.addEventListener(
            "click",
            event => {
                if (
                    event.target === imageViewer
                ) {
                    closeImageViewer();
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Escape" &&
                    imageViewer.classList.contains(
                        "open"
                    )
                ) {
                    closeImageViewer();
                }
            }
        );

        /*
        ============================================
        START PAGE
        ============================================
        */

        if (seasons.length > 0) {
            createSeasonButtons();
            renderCards();
        } else {
            content.innerHTML = `
                    <p style="text-align:center;">
                        No Store Tournament seasons have been added.
                    </p>
                `;
        }
    

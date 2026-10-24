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
            seasons[seasons.length - 1];

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
                /^(\d{4})-season-(\d+)$/
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
                `${number}${suffix}.png`;

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

        function renderCards() {
            const details =
                getSeasonDetails(selectedSeason);

            const categoryName =
                selectedType === "winner"
                    ? "Winner Promos"
                    : "Participation Promos";

            content.innerHTML = `
                    <h2 class="season-title">
                        ${details.fullName}
                    </h2>

                    <h3 class="category-title">
                        ${categoryName}
                    </h3>

                    <div class="promo-grid">
                        ${createCardGrid()}
                    </div>
                `;

            updateSeasonButtons();
            updateTypeButtons();
            attachImageViewerButtons();
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

                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });
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
    

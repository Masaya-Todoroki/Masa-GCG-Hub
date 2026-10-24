        function getSetFromUrl() {
            const params = new URLSearchParams(window.location.search);
            return (params.get("set") || "").toUpperCase();
        }

        function updateUrlSet(setCode) {
            const url = new URL(window.location.href);
            url.searchParams.set("set", setCode);
            window.history.pushState({}, "", url);
        }

        function renderSetButtons() {
            setButtons.innerHTML = "";

            // Home button
            const homeButton = document.createElement("button");
            homeButton.className = "set-button";
            homeButton.textContent = "Home";

            homeButton.addEventListener("click", () => {
                window.location.href = "index.html";
            });

            setButtons.appendChild(homeButton);

            // Set buttons
            SETS.filter(set => showHiddenSets || !HIDDEN_SET_CODES.has(set.code)).forEach(set => {
                const button = document.createElement("button");
                button.className = "set-button";
                button.textContent = set.label;

                if (currentSet && set.code === currentSet.code) {
                    button.classList.add("active");
                }

                button.addEventListener("click", () => {
                    loadSet(set.code, true);
                });

                setButtons.appendChild(button);
            });
        }

        async function loadSet(setCode, shouldUpdateUrl = false) {
            const requestedSet = SETS.find(set => set.code.toUpperCase() === String(setCode).toUpperCase()) || SETS[0];
            const isLocked = HIDDEN_SET_CODES.has(requestedSet.code) && !showHiddenSets;
            const selectedSet = isLocked ? SETS[0] : requestedSet;
            if (isLocked) {
                // Replace rather than push: Back won't reopen the locked preview URL.
                const safeUrl = new URL(window.location.href);
                safeUrl.searchParams.set("set", selectedSet.code);
                window.history.replaceState({}, "", safeUrl);
            }
            currentSet = selectedSet;

            pageTitle.textContent = selectedSet.title;
            document.title = selectedSet.title;
            searchInput.value = "";

            statusBox.classList.remove("hidden");
            statusBox.textContent = `Loading ${selectedSet.label} card data...`;
            galleryView.classList.add("hidden");
            detailView.classList.add("hidden");
            galleryEmpty.classList.add("hidden");
            emptyMessage.classList.add("hidden");
            cardGrid.innerHTML = "";
            pairGrid.innerHTML = "";
            selectedCard.innerHTML = "";
            detailTitle.textContent = "";
            pricingLinks = {};

            renderSetButtons();

            try {
                const response = await fetch(selectedSet.csvUrl);

                if (!response.ok) {
                    throw new Error(`Could not load ${selectedSet.csvUrl}`);
                }

                const text = await response.text();
                cards = parseCSV(text).map(card => ({
                    id: card.id,
                    name: card.name,
                    type: card.type,
                    pairs: []
                }));

                cardMap = Object.fromEntries(cards.map(card => [card.id, card]));
                await loadPricingLinks(selectedSet.csvUrl);

                const supabasePairMap = await loadSupabasePairings(selectedSet.code);
                applySupabasePairings(supabasePairMap);

                const databasePairCount = Object.values(supabasePairMap)
                    .reduce((total, pairSet) => total + pairSet.size, 0) / 2;

                const supabaseMessage = `Masa's pairing database loaded!`;
                console.log(supabaseMessage);

                // Rebuild after Supabase data has been applied.
                cardMap = Object.fromEntries(cards.map(card => [card.id, card]));

                statusBox.textContent = supabaseMessage;
                statusBox.classList.remove("hidden");
                galleryView.classList.remove("hidden");
                renderGallery();

                // Keep the connection result visible briefly, then hide it.
                window.clearTimeout(window.supabaseStatusTimeout);
                window.supabaseStatusTimeout = window.setTimeout(() => {
                    statusBox.classList.add("hidden");
                }, 3500);
                renderSetButtons();

                if (shouldUpdateUrl) {
                    updateUrlSet(selectedSet.code);
                }
            } catch (error) {
                console.error(error);

                statusBox.innerHTML = `
                            <strong>Could not load ${selectedSet.label}.</strong>
                            <div class="small-note">Error: ${error.message}</div>
                        `;
            }
        }

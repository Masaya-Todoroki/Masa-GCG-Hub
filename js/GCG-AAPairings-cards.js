        function createCardElement(card, onClick) {
            const cardEl = document.createElement("div");
            cardEl.className = "card";

            cardEl.innerHTML = `
                        <div class="card-art"><img src="${getImage(card.id)}" alt="${card.name}" loading="lazy"><div class="reveal-ribbon">TO BE REVEALED</div></div>
                        <div class="card-text">
                            <div class="card-name">${card.name}</div>
                            <div class="type-box">${card.type}</div>
                        </div>
                    `;

            enableImageFallback(cardEl.querySelector("img"), card.id);
            cardEl.addEventListener("click", () => onClick(card));
            return cardEl;
        }

        function renderGallery(filteredCards = cards) {
            cardGrid.innerHTML = "";

            if (filteredCards.length === 0) {
                galleryEmpty.classList.remove("hidden");
                return;
            }

            galleryEmpty.classList.add("hidden");

            filteredCards.forEach(card => {
                cardGrid.appendChild(createCardElement(card, openDetailView));
            });
        }

        function openDetailView(card) {
            galleryView.classList.add("hidden");
            detailView.classList.remove("hidden");

            detailTitle.textContent = card.name;

            const pricingHTML = getPricingHTML(card.id);

            selectedCard.innerHTML = `
                        <div class="card-art"><img src="${getImage(card.id)}" alt="${card.name}"><div class="reveal-ribbon">TO BE REVEALED</div></div>
                        <div class="selected-info">
                            <h2>${card.name}</h2>
                            <p><strong>ID:</strong> ${card.id}</p>
                            <p><strong>Type:</strong> ${card.type}</p>
                            <p><strong>Number of pairs:</strong> ${card.pairs.length}</p>
                            ${pricingHTML}
                        </div>
                    `;

            enableImageFallback(selectedCard.querySelector("img"), card.id);

            pairGrid.innerHTML = "";

            const pairedCards = card.pairs
                .map(pairId => cardMap[pairId])
                .filter(Boolean)
                .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

            if (pairedCards.length === 0) {
                emptyMessage.classList.remove("hidden");
            } else {
                emptyMessage.classList.add("hidden");

                pairedCards.forEach(pairCard => {
                    pairGrid.appendChild(createCardElement(pairCard, openDetailView));
                });
            }
        }

        function goBack() {
            detailView.classList.add("hidden");
            galleryView.classList.remove("hidden");
        }

        function handleSearch() {
            const term = searchInput.value.trim().toLowerCase();

            if (!term) {
                renderGallery(cards);
                return;
            }

            const filteredCards = cards.filter(card =>
                card.name.toLowerCase().includes(term) ||
                card.id.toLowerCase().includes(term) ||
                card.type.toLowerCase().includes(term)
            );

            renderGallery(filteredCards);
        }

        // Supabase connection.
        // Paste the complete Publishable key below. Do not use the service_role key.
        const SUPABASE_URL = "https://vixudhbgvihtdynhcfey.supabase.co";
        const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zBf__8-D1Tu01z6i8Tg96g_Rx4BL33r";

        // The existing secret shortcut / long-press unlocks all hidden sets.
        const HIDDEN_SET_CODES = new Set(SETS.filter(set => set.hidden).map(set => set.code));
        const PREVIEW_SESSION_KEY = "gcg-aa-hidden-preview";
        let showHiddenSets = sessionStorage.getItem(PREVIEW_SESSION_KEY) === "unlocked";

        function toggleHiddenSets() {
            showHiddenSets = !showHiddenSets;
            if (showHiddenSets) {
                sessionStorage.setItem(PREVIEW_SESSION_KEY, "unlocked");
            } else {
                sessionStorage.removeItem(PREVIEW_SESSION_KEY);
            }
            if (!showHiddenSets && currentSet && HIDDEN_SET_CODES.has(currentSet.code)) {
                loadSet(SETS[0].code, true);
            } else {
                renderSetButtons();
            }
        }

        let currentSet = null;
        let cards = [];
        let cardMap = {};
        let pricingLinks = {};

        const pageTitle = document.getElementById("page-title");
        const setButtons = document.getElementById("set-buttons");
        const statusBox = document.getElementById("status-box");
        const galleryView = document.getElementById("gallery-view");
        const detailView = document.getElementById("detail-view");
        const cardGrid = document.getElementById("card-grid");
        const pairGrid = document.getElementById("pair-grid");
        const detailTitle = document.getElementById("detail-title");
        const selectedCard = document.getElementById("selected-card");
        const backButton = document.getElementById("back-button");
        const emptyMessage = document.getElementById("empty-message");
        const searchInput = document.getElementById("search-input");
        const galleryEmpty = document.getElementById("gallery-empty");

        function getImage(cardId) {
            return `${currentSet.imageFolder}/${cardId}.webp`;
        }

        // Try the alt art first, then the regular card, then a generic placeholder.
        function enableImageFallback(img, cardId) {
            if (!img) return;
            const setCode = cardId.split("-")[0];
            const fallbackImages = [
                `DeckBuilder/Cards/${setCode}/${cardId}.webp`,
                "images/basic/Card_White.png"
            ];
            let nextFallback = 0;
            img.addEventListener("error", () => {
                if (nextFallback < fallbackImages.length) {
                    img.closest(".card-art")?.classList.add("unrevealed");
                    img.src = fallbackImages[nextFallback++];
                }
            });
        }

        // Supports GD04-001, EB01-001, ST01-001, or similar future set codes.
        function extractCardId(value) {
            return String(value || "").substring(0, 8).toUpperCase();
        }

        function removeCardId(value) {
            return String(value || "").replace(/[A-Z]{2}\d{2}-\d{3}/i, "").trim();
        }

        function normalizeName(value) {
            return String(value || "")
                .trim()
                .replace(/\s+/g, " ")
                .replace(/[“”]/g, '"')
                .replace(/[‘’]/g, "'");
        }

        function parseCSVLine(line) {
            const values = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === "," && !inQuotes) {
                    values.push(current);
                    current = "";
                } else {
                    current += char;
                }
            }

            values.push(current);
            return values.map(value => value.trim());
        }

        function parseCSV(text) {
            const lines = text
                .split(/\r?\n/)
                .filter(line => line.trim() !== "");

            if (lines.length < 2) {
                return [];
            }

            const result = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);

                // Only the first two CSV columns are used:
                // 0 = Type
                // 1 = Card name with ID at front, e.g. "GD04-001 Gundam"
                // Any older pairing columns after this are deliberately ignored.
                const type = (cols[0] || "").trim();
                const id = extractCardId(cols[1]);
                const name = normalizeName(removeCardId(cols[1] || ""));

                if (!id || !name) {
                    console.log("Skipped row because ID or name was missing:", cols);
                    continue;
                }

                result.push({
                    id,
                    type,
                    name
                });
            }

            return result;
        }

        function getFolderFromUrl(url) {
            const lastSlashIndex = String(url || "").lastIndexOf("/");
            return lastSlashIndex === -1 ? "" : String(url).slice(0, lastSlashIndex + 1);
        }

        async function loadPricingLinks(csvUrl) {
            pricingLinks = {};

            const pricingUrl = `${getFolderFromUrl(csvUrl)}AAPricing.csv`;

            try {
                const response = await fetch(pricingUrl);

                if (!response.ok) {
                    console.log(`No pricing CSV found at ${pricingUrl}. Links will be hidden.`);
                    return;
                }

                const text = await response.text();
                const lines = text
                    .split(/\r?\n/)
                    .filter(line => line.trim() !== "");

                const headers = parseCSVLine(lines[0]);

                for (let i = 1; i < lines.length; i++) {
                    const cols = parseCSVLine(lines[i]);

                    const id = extractCardId(cols[0]);

                    if (!id) continue;

                    pricingLinks[id] = {};

                    for (let j = 1; j < headers.length; j++) {
                        const key = headers[j].trim().toLowerCase();
                        pricingLinks[id][key] = (cols[j] || "").trim();
                    }
                }
            } catch (error) {
                console.log("Could not load pricing links. Links will be hidden.", error);
            }
        }

        function getPricingHTML(cardId) {
            const links = pricingLinks[cardId];

            if (!links) {
                return "";
            }

            let html = "";

            Object.entries(links).forEach(([site, url]) => {
                if (url) {
                    const name = site.charAt(0).toUpperCase() + site.slice(1);

                    html += `
                    <p><strong>${name}:</strong>
                    <a href="${url}" target="_blank" rel="noopener noreferrer">
                        Open Site
                    </a></p>`;
                }
            });

            return html;
        }

        function hasSupabaseConfig() {
            return (
                SUPABASE_URL &&
                SUPABASE_PUBLISHABLE_KEY &&
                !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR")
            );
        }

        async function loadSupabasePairings(setCode) {
            if (!hasSupabaseConfig()) {
                throw new Error("Masa forgot something!!!");
            }

            // Only request rows where either side begins with the selected set code.
            const encodedSet = encodeURIComponent(`${setCode}-%`);
            const query = `or=(card_1.like.${encodedSet},card_2.like.${encodedSet})&select=card_1,card_2`;
            const url = `${SUPABASE_URL}/rest/v1/pairings?${query}`;

            const response = await fetch(url, {
                headers: {
                    apikey: SUPABASE_PUBLISHABLE_KEY,
                    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
                }
            });

            if (!response.ok) {
                const details = await response.text();
                throw new Error(`Error Code: ${response.status}: ${details}`);
            }

            const rows = await response.json();
            const pairMap = {};

            function addPair(fromId, toId) {
                if (!fromId || !toId || fromId === toId) return;
                if (!pairMap[fromId]) pairMap[fromId] = new Set();
                pairMap[fromId].add(toId);
            }

            rows.forEach(row => {
                const card1 = String(row.card_1 || "").trim().toUpperCase();
                const card2 = String(row.card_2 || "").trim().toUpperCase();

                // A single database row works in both directions on the website.
                addPair(card1, card2);
                addPair(card2, card1);
            });

            return pairMap;
        }

        function applySupabasePairings(pairMap) {
            cards.forEach(card => {
                card.pairs = pairMap[card.id]
                    ? Array.from(pairMap[card.id])
                    : [];
            });
        }

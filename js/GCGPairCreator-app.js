let currentSet = SETS[0];
let cards = [];
let jsonCardIds = new Set();
let extraCardIds = new Set();
let verifiedPassword = "";
let refreshTimer = null;
let cardMap = {};

let selectedCard1 = null;
let selectedCard2 = null;

let existingPairs = new Set();
let pairRows = [];

let currentMode = "add";
let deletePrimaryCard = null;
let deleteSecondaryCard = null;

let databaseBusy = false;
let modalCloseAction = null;

/* Elements */
const versionBadge = document.getElementById("version-badge");
const passwordScreen = document.getElementById("password-screen");
const passwordInput = document.getElementById("password-input");
const passwordButton = document.getElementById("password-button");
const passwordMessage = document.getElementById("password-message");

const app = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
const homeButton = document.getElementById("home-button");
const modeToggle = document.getElementById("mode-toggle");
const setSelect = document.getElementById("set-select");
const addCardButton = document.getElementById("add-card-button");
const refreshCardsButton = document.getElementById("refresh-cards-button");
const addCardModal = document.getElementById("add-card-modal");
const addCardInput = document.getElementById("add-card-input");
const addCardFeedback = document.getElementById("add-card-feedback");
const addCardPreview = document.getElementById("add-card-preview");
const addCardCancel = document.getElementById("add-card-cancel");
const addCardNext = document.getElementById("add-card-next");
const addCardConfirm = document.getElementById("add-card-confirm");
let pendingCardId = null;

const galleryView = document.getElementById("gallery-view");
const status = document.getElementById("status");
const cardGrid = document.getElementById("card-grid");
const emptyState = document.getElementById("empty-state");

const selected1 = document.getElementById("selected-1");
const selected2 = document.getElementById("selected-2");
const createPairButton = document.getElementById("create-pair");

const deletePairsView = document.getElementById("delete-pairs-view");
const deletePairsBack = document.getElementById("delete-pairs-back");
const deletePairsTitle = document.getElementById("delete-pairs-title");
const deleteSelectedCard = document.getElementById("delete-selected-card");
const pairGrid = document.getElementById("pair-grid");
const noPairsMessage = document.getElementById("no-pairs-message");

const deleteConfirmView = document.getElementById("delete-confirm-view");
const deleteConfirmBack = document.getElementById("delete-confirm-back");
const confirmCard1 = document.getElementById("confirm-card-1");
const confirmCard2 = document.getElementById("confirm-card-2");
const deletePairButton = document.getElementById("delete-pair-button");

const statusModal = document.getElementById("status-modal");
const statusModalTitle = document.getElementById("status-modal-title");
const statusModalMessage = document.getElementById("status-modal-message");
const statusModalOk = document.getElementById("status-modal-ok");
const statusSpinner = document.getElementById("status-spinner");

/* Password */
async function validatePassword() {
    const password = passwordInput.value;

    if (!password) {
        passwordMessage.textContent = "Enter a password.";
        return;
    }

    passwordButton.disabled = true;
    passwordMessage.textContent = "Checking...";

    try {
        const response = await fetch(SUPABASE_URL + PASSWORD_CHECK_PATH, {
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                "apikey":SUPABASE_PUBLISHABLE_KEY,
                "Authorization":`Bearer ${SUPABASE_PUBLISHABLE_KEY}`
            },
            body:JSON.stringify({ password })
        });

        if (!response.ok) {
            throw new Error(`Password check failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.valid) {
            passwordMessage.textContent = "Incorrect password.";
            passwordButton.disabled = false;
            return;
        }

        verifiedPassword = password;
        passwordMessage.textContent = "";
        passwordScreen.classList.add("hidden");
        versionBadge.classList.add("hidden");
        app.classList.remove("hidden");

        await initializeApp();
    }
    catch (error) {
        console.error(error);
        passwordMessage.textContent = "Could not verify password.";
        passwordButton.disabled = false;
    }
}

passwordButton.addEventListener("click", validatePassword);
passwordInput.addEventListener("keydown", event => {
    if (event.key === "Enter") validatePassword();
});

/* CSV */
function parseCSVLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
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

function extractCardId(value) {
    const match = String(value || "").match(/[A-Z]{2}\d{2}-\d{3}/i);
    return match ? match[0].toUpperCase() : "";
}

function removeCardId(value) {
    return String(value || "").replace(/[A-Z]{2}\d{2}-\d{3}/i, "").trim();
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return [];

    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const type = (cols[0] || "").trim();
        const id = extractCardId(cols[1]);
        const name = removeCardId(cols[1]);

        if (!id) continue;
        result.push({ id, type, name });
    }

    return result;
}

/* General helpers */
function normalizePair(card1, card2) {
    return [card1, card2]
        .map(value => String(value).trim().toUpperCase())
        .sort((a,b) => a.localeCompare(b))
        .join("|");
}

// GD06 reveal status follows the actual artwork, not CSV membership.
// The official alt-art image is attempted first. If missing, show the label
// while displaying the normal DeckBuilder image (or the card back).
function fallbackCardImage(img) {
    const id = img.alt || "";
    const label = img.parentElement?.querySelector(".unrevealed-label");
    if (id.startsWith("GD06-")) {
        if (label) label.classList.remove("hidden");
        if (!img.dataset.triedNormal) {
            img.dataset.triedNormal = "1";
            img.src = `DeckBuilder/Cards/GD06/${id}.webp`;
            return;
        }
    }
    img.onerror = null;
    img.src = CARD_BACK_URL;
}
function cardImageHTML(id, lazy = false) {
    const safeId = String(id).replace(/[^A-Z0-9-]/g, "");
    const url = getImageUrlById(safeId);
    const label = safeId.startsWith("GD06-")
        ? `<span class="unrevealed-label hidden">TO BE REVEALED</span>` : "";
    return `<img src="${url}" alt="${safeId}" ${lazy ? 'loading="lazy"' : ''} draggable="false" onerror="fallbackCardImage(this)">${label}`;
}
function normalizeNewId(value) {
    const v = String(value || "").trim().toUpperCase();
    const match = v.match(/^(?:GD06-?)?(\d{1,3})$/);
    if (!match) return null;
    const n = Number(match[1]);
    if (n < 1 || n > 999) return null;
    return `GD06-${String(n).padStart(3, "0")}`;
}
function getAllCardIds() { return new Set(cards.map(card => card.id)); }
function mergeExtraCards(ids) {
    if (currentSet.code !== "GD06") return;
    const nextIds = new Set(ids);
    const changed = nextIds.size !== extraCardIds.size || [...nextIds].some(id => !extraCardIds.has(id));
    if (!changed) return false;
    extraCardIds = nextIds;
    const merged = new Map(cards.filter(card => jsonCardIds.has(card.id)).map(card => [card.id, card]));
    for (const id of ids) {
        if (!merged.has(id)) merged.set(id, {id, name:id, type:""});
    }
    cards = Array.from(merged.values()).sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric:true}));
    cardMap = Object.fromEntries(cards.map(card => [card.id,card]));
    renderGalleryCards();
    renderSelectedCards();
    setStatus(`${cards.length} cards loaded (${ids.filter(id => !jsonCardIds.has(id)).length} manually added).`);
    return true;
}
async function fetchExtraCards() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pairing_cards?select=card_id`, {
        headers:{"apikey":SUPABASE_PUBLISHABLE_KEY, "Accept":"application/json"},
        cache:"no-store"
    });
    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(`Supabase ${response.status}: ${detail.message || detail.error || response.statusText}`);
    }
    const data = await response.json();
    return data.map(row => row.card_id).filter(id => /^GD06-\d{3}$/.test(id));
}
async function refreshExtraCards() {
    if (currentSet.code !== "GD06") return;
    const ids = await fetchExtraCards();
    if (currentSet.code === "GD06") return mergeExtraCards(ids);
    return false;
}
refreshCardsButton.addEventListener("click", async () => {
    if (currentSet.code !== "GD06" || databaseBusy || refreshCardsButton.disabled) return;
    refreshCardsButton.disabled = true;
    const previousText = refreshCardsButton.textContent;
    refreshCardsButton.textContent = "Refreshing...";
    try {
        await refreshExtraCards();
        setStatus(`${cards.length} cards loaded. Cards refreshed.`);
    } catch (error) {
        console.error(error);
        setStatus(`Could not refresh cards: ${error.message}`);
    } finally {
        refreshCardsButton.disabled = false;
        refreshCardsButton.textContent = previousText;
    }
});
function getImageUrl(card) {
    return getImageUrlById(card.id);
}

function getImageUrlById(cardId) {
    const id = String(cardId || "").toUpperCase();
    const setCode = id.substring(0,4);
    const set = SETS.find(item => item.code === setCode) || currentSet;
    return set.code === "GD06" ? `images/GD06/${id}.webp` : `${set.imageFolder}/${id}.webp`;
}

function getCardById(cardId) {
    const id = String(cardId || "").toUpperCase();

    if (cardMap[id]) {
        return cardMap[id];
    }

    return {
        id,
        name:id,
        type:""
    };
}

function setStatus(message) {
    status.textContent = message;
}

function showView(view) {
    galleryView.classList.add("hidden");
    deletePairsView.classList.add("hidden");
    deleteConfirmView.classList.add("hidden");
    view.classList.remove("hidden");
}

/* Pair database */
async function loadPairings() {
    const url = `${SUPABASE_URL}/rest/v1/pairings?select=card_1,card_2`;

    const response = await fetch(url, {
        headers:{
            "apikey":SUPABASE_PUBLISHABLE_KEY,
            "Authorization":`Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        }
    });

    if (!response.ok) {
        throw new Error("Could not load pairings.");
    }

    const rows = await response.json();

    existingPairs.clear();
    pairRows = [];

    rows.forEach(row => {
        const card1 = String(row.card_1 || "").trim().toUpperCase();
        const card2 = String(row.card_2 || "").trim().toUpperCase();

        if (!card1 || !card2) return;

        existingPairs.add(normalizePair(card1, card2));
        pairRows.push({ card_1:card1, card_2:card2 });
    });
}

function getPairedIds(cardId) {
    const id = String(cardId || "").trim().toUpperCase();
    const results = new Set();

    pairRows.forEach(row => {
        if (row.card_1 === id && row.card_2 !== id) {
            results.add(row.card_2);
        }
        if (row.card_2 === id && row.card_1 !== id) {
            results.add(row.card_1);
        }
    });

    return Array.from(results)
        .sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
}

/* Shared status modal */
function showStatusModal(message, busy = false, title = "Pair Status", onClose = null) {
    statusModalTitle.textContent = title;
    statusModalMessage.textContent = message;
    statusSpinner.classList.toggle("hidden", !busy);
    statusModalOk.disabled = busy;
    modalCloseAction = onClose;
    statusModal.classList.remove("hidden");
}

function finishStatusModal(message, title = "Pair Status", onClose = null) {
    statusModalTitle.textContent = title;
    statusModalMessage.textContent = message;
    statusSpinner.classList.add("hidden");
    statusModalOk.disabled = false;
    modalCloseAction = onClose;
    statusModalOk.focus();
}

async function closeStatusModal() {
    if (databaseBusy) return;

    statusModal.classList.add("hidden");

    const action = modalCloseAction;
    modalCloseAction = null;

    if (action) {
        await action();
    }
}

/* Add mode */
function clearSelection() {
    selectedCard1 = null;
    selectedCard2 = null;
    renderSelectedCards();

    if (currentMode === "add") {
        renderGalleryCards();
    }
}

function selectAddCard(card) {
    if (selectedCard1 && selectedCard1.id === card.id) {
        selectedCard1 = null;
    }
    else if (selectedCard2 && selectedCard2.id === card.id) {
        selectedCard2 = null;
    }
    else if (!selectedCard1) {
        selectedCard1 = card;
    }
    else if (!selectedCard2) {
        selectedCard2 = card;
    }

    renderSelectedCards();
    updateGallerySelection();
}

function renderSelectedCard(container, card) {
    const src = card ? getImageUrl(card) : CARD_BACK_URL;
    const alt = card ? card.id : "Card back";

    container.innerHTML = card ? cardImageHTML(card.id) :
        `<img src="${src}" alt="${alt}" draggable="false">`;
}

function renderSelectedCards() {
    renderSelectedCard(selected1, selectedCard1);
    renderSelectedCard(selected2, selectedCard2);
}

async function createPair() {
    if (databaseBusy) return;

    if (!selectedCard1 || !selectedCard2) {
        showStatusModal("Select two cards first.", false, "Pair Upload");
        return;
    }

    const card1 = selectedCard1.id;
    const card2 = selectedCard2.id;
    const key = normalizePair(card1, card2);

    if (existingPairs.has(key)) {
        showStatusModal("Pair already exists.", false, "Pair Upload");
        return;
    }

    databaseBusy = true;
    createPairButton.disabled = true;

    showStatusModal(
        `Uploading ${card1} + ${card2}...`,
        true,
        "Pair Upload"
    );

    const ordered = [card1, card2].sort((a,b) => a.localeCompare(b));

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pairings`, {
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                "apikey":SUPABASE_PUBLISHABLE_KEY,
                "Authorization":`Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                "Prefer":"return=minimal"
            },
            body:JSON.stringify([{
                card_1:ordered[0],
                card_2:ordered[1]
            }])
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        existingPairs.add(key);
        pairRows.push({
            card_1:ordered[0],
            card_2:ordered[1]
        });

        clearSelection();
        finishStatusModal("Pair uploaded!", "Pair Upload");
    }
    catch (error) {
        console.error(error);
        finishStatusModal("Upload failed. Please try again.", "Pair Upload");
    }
    finally {
        databaseBusy = false;
        createPairButton.disabled = false;
    }
}

/* Main gallery */
function createGalleryCard(card, clickHandler) {
    const button = document.createElement("button");
    button.className = "card-button";
    button.dataset.cardId = card.id;

    if (currentMode === "add") {
        if (selectedCard1 && selectedCard1.id === card.id) {
            button.classList.add("selected-1");
        }
        if (selectedCard2 && selectedCard2.id === card.id) {
            button.classList.add("selected-2");
        }
    }

    button.innerHTML = cardImageHTML(card.id, true);

    button.addEventListener("click", () => {
        if (Date.now() < suppressCardClickUntil) return;
        clickHandler(card);
    });

    return button;
}

function updateGallerySelection() {
    for (const button of cardGrid.children) {
        const id = button.dataset.cardId;
        button.classList.toggle("selected-1", currentMode === "add" && selectedCard1?.id === id);
        button.classList.toggle("selected-2", currentMode === "add" && selectedCard2?.id === id);
    }
}

function renderGalleryCards() {
    cardGrid.innerHTML = "";

    emptyState.classList.toggle("hidden", cards.length > 0);

    cards.forEach(card => {
        const clickHandler =
            currentMode === "add"
                ? selectAddCard
                : openDeletePairs;

        cardGrid.appendChild(
            createGalleryCard(card, clickHandler)
        );
    });
}

/* Delete mode */
function openDeletePairs(card) {
    deletePrimaryCard = card;
    deleteSecondaryCard = null;

    deletePairsTitle.textContent =
        `${card.id} — choose the paired card to delete`;

    deleteSelectedCard.innerHTML = cardImageHTML(card.id);

    renderPairedCards(card);
    showView(deletePairsView);
}

function renderPairedCards(card) {
    pairGrid.innerHTML = "";

    const pairedIds = getPairedIds(card.id);

    noPairsMessage.classList.toggle(
        "hidden",
        pairedIds.length > 0
    );

    pairedIds.forEach(pairId => {
        const pairCard = getCardById(pairId);

        const button = document.createElement("button");
        button.className = "card-button";
    button.dataset.cardId = card.id;
        button.innerHTML = cardImageHTML(pairId, true);

        button.addEventListener("click", () => {
            openDeleteConfirm(card, pairCard);
        });

        pairGrid.appendChild(button);
    });
}

function openDeleteConfirm(card1, card2) {
    deletePrimaryCard = card1;
    deleteSecondaryCard = card2;

    confirmCard1.innerHTML = cardImageHTML(card1.id);

    confirmCard2.innerHTML = cardImageHTML(card2.id);

    deletePairButton.textContent =
        `Delete ${card1.id} + ${card2.id}`;

    showView(deleteConfirmView);
}

async function deleteExactPair(card1, card2) {
    const url =
        `${SUPABASE_URL}/rest/v1/pairings` +
        `?card_1=eq.${encodeURIComponent(card1)}` +
        `&card_2=eq.${encodeURIComponent(card2)}`;

    const response = await fetch(url, {
        method:"DELETE",
        headers:{
            "apikey":SUPABASE_PUBLISHABLE_KEY,
            "Authorization":`Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            "Prefer":"return=representation"
        }
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`Delete failed: ${response.status} ${details}`);
    }

    try {
        const deletedRows = await response.json();
        return Array.isArray(deletedRows)
            ? deletedRows.length
            : 0;
    }
    catch (_) {
        return 0;
    }
}

async function deleteSelectedPair() {
    if (
        databaseBusy ||
        !deletePrimaryCard ||
        !deleteSecondaryCard
    ) {
        return;
    }

    const card1 = deletePrimaryCard.id.toUpperCase();
    const card2 = deleteSecondaryCard.id.toUpperCase();

    databaseBusy = true;
    deletePairButton.disabled = true;

    showStatusModal(
        `Deleting ${card1} + ${card2}...`,
        true,
        "Delete Pair"
    );

    try {
        const ordered =
            [card1, card2].sort((a,b) => a.localeCompare(b));

        let deletedCount =
            await deleteExactPair(ordered[0], ordered[1]);

        // Fallback for any older row stored in the opposite order.
        if (deletedCount === 0) {
            deletedCount =
                await deleteExactPair(ordered[1], ordered[0]);
        }

        if (deletedCount === 0) {
            throw new Error(
                "No matching row was deleted. Supabase may need a DELETE policy for the pairings table."
            );
        }

        finishStatusModal(
            "Pair deleted!",
            "Delete Pair",
            async () => {
                setStatus("Refreshing pair database...");

                try {
                    await loadPairings();

                    if (
                        currentMode === "delete" &&
                        deletePrimaryCard
                    ) {
                        openDeletePairs(deletePrimaryCard);
                        setStatus(`${cards.length} cards loaded.`);
                    }
                }
                catch (error) {
                    console.error(error);
                    showView(galleryView);
                    setStatus("Could not refresh pair database.");
                }
            }
        );
    }
    catch (error) {
        console.error(error);

        finishStatusModal(
            "Delete failed. Check the Supabase DELETE policy and try again.",
            "Delete Pair"
        );
    }
    finally {
        databaseBusy = false;
        deletePairButton.disabled = false;
    }
}

/* Mode */
function setMode(mode) {
    currentMode = mode === "delete" ? "delete" : "add";

    clearSelection();

    deletePrimaryCard = null;
    deleteSecondaryCard = null;

    showView(galleryView);

    const deleteMode = currentMode === "delete";

    sidebar.classList.toggle("delete-mode", deleteMode);
    modeToggle.classList.toggle("delete-active", deleteMode);

    modeToggle.textContent =
        deleteMode
            ? "Switch to Add Pairs"
            : "Switch to Delete Pairs";

    setStatus(
        deleteMode
            ? `${cards.length} cards loaded. Select a card to view its pairs.`
            : `${cards.length} cards loaded.`
    );

    renderGalleryCards();
}

/* Set loading */
async function loadSet(code) {
    const set = SETS.find(item => item.code === code);
    if (!set) return;

    currentSet = set;
    addCardButton.classList.toggle("hidden", set.code !== "GD06");
    refreshCardsButton.classList.toggle("hidden", set.code !== "GD06");
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    jsonCardIds.clear(); extraCardIds.clear();

    selectedCard1 = null;
    selectedCard2 = null;
    deletePrimaryCard = null;
    deleteSecondaryCard = null;

    renderSelectedCards();
    showView(galleryView);

    setStatus(`Loading ${set.code}...`);

    try {
        if (false && set.jsonUrl) {
            const candidates = [
                set.jsonUrl,
                "DeckBuilder/data/GD06.json",
                "DeckBuilder/GD06.json",
                "data/GD06.json",
                "Data/GD06.json",
                "GD06.json"
            ];
            let json = null;
            const failures = [];
            for (const path of [...new Set(candidates)]) {
                try {
                    const response = await fetch(path, {cache:"no-store"});
                    if (!response.ok) { failures.push(`${path} (${response.status})`); continue; }
                    json = await response.json();
                    break;
                } catch (error) { failures.push(`${path} (${error.message})`); }
            }
            if (!json) throw new Error(`GD06 JSON not found. Checked: ${failures.join(", ")}`);
            const entries = Array.isArray(json) ? json : (json.cards || []);
            cards = entries.filter(card => card && /^GD06-\d{3}$/.test(String(card.id || "")))
                .map(card => ({id:card.id, name:card.name || card.id, type:card.type || ""}));
            jsonCardIds = new Set(cards.map(card => card.id));
        } else {
            const response = await fetch(set.csvUrl);
            if (!response.ok) throw new Error(`Could not load ${set.csvUrl}`);
            cards = parseCSV(await response.text());
            if (set.code === "GD06") {
                cards = cards.filter(card => /^GD06-\d{3}$/.test(card.id));
                jsonCardIds = new Set(cards.map(card => card.id));
            }
        }

        cardMap = {};
        cards.forEach(card => {
            cardMap[card.id] = card;
        });

        cardGrid.scrollTop = 0;
        renderGalleryCards();

        setStatus(`${cards.length} cards loaded.`);
        if (set.code === "GD06") {
            try { await refreshExtraCards(); }
            catch (error) { console.error(error); setStatus(`${cards.length} CSV cards loaded. Could not load Supabase extras: ${error.message}`); }
            refreshTimer = setInterval(() => {
                if (currentSet.code === "GD06" && !databaseBusy) refreshExtraCards().catch(console.error);
            }, 20000);
        }
    }
    catch (error) {
        console.error(error);
        cards = [];
        cardMap = {};
        renderGalleryCards();
        setStatus(error.message);
    }
}

async function initializeApp() {
    setSelect.innerHTML = "";

    SETS.forEach(set => {
        const option = document.createElement("option");
        option.value = set.code;
        option.textContent = set.code;
        setSelect.appendChild(option);
    });

    renderSelectedCards();

    setStatus("Loading pair database...");

    try {
        await loadPairings();
    }
    catch (error) {
        console.error(error);
        setStatus("Could not load existing pairings.");
    }

    await loadSet(setSelect.value);
}


/* Add unrevealed GD06 card */
function closeAddCardModal() {
    if (databaseBusy) return;
    addCardModal.classList.add("hidden");
    pendingCardId = null;
}
addCardButton.addEventListener("click", () => {
    pendingCardId = null;
    addCardInput.value = "";
    addCardFeedback.textContent = "";
    addCardPreview.classList.add("hidden");
    addCardNext.classList.remove("hidden");
    addCardConfirm.classList.add("hidden");
    addCardModal.classList.remove("hidden");
    addCardInput.focus();
});
addCardCancel.addEventListener("click", closeAddCardModal);
addCardInput.addEventListener("input", () => {
    addCardInput.value = addCardInput.value.replace(/\D/g, "").slice(0, 3);
    pendingCardId = null;
    addCardNext.classList.remove("hidden");
    addCardConfirm.classList.add("hidden");
    addCardPreview.classList.add("hidden");
    addCardFeedback.textContent = "";
});
addCardInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !addCardNext.classList.contains("hidden")) addCardNext.click();
});
addCardNext.addEventListener("click", () => {
    const rawNumber = addCardInput.value.trim();
    if (!/^\d{3}$/.test(rawNumber) || rawNumber === "000") {
        addCardFeedback.textContent = "Enter exactly three digits (001–999).";
        return;
    }
    const id = normalizeNewId(rawNumber);
    // Preview must not depend on Supabase being configured or reachable.
    if (getAllCardIds().has(id)) {
        addCardFeedback.textContent = `${id} already exists in the gallery.`;
        return;
    }
    pendingCardId = id;
    addCardPreview.innerHTML = `<img src="DeckBuilder/Cards/GD06/${id}.webp" alt="${id}" onerror="this.onerror=null;this.src='${CARD_BACK_URL}'"><div class="unrevealed-label">TO BE REVEALED<br>${id}</div>`;
    addCardPreview.classList.remove("hidden");
    addCardFeedback.textContent = `Confirm the normal card artwork for ${id}.`;
    addCardNext.classList.add("hidden");
    addCardConfirm.classList.remove("hidden");
});
addCardConfirm.addEventListener("click", async () => {
    if (!pendingCardId || databaseBusy) return;
    databaseBusy = true;
    addCardConfirm.disabled = true;
    addCardFeedback.textContent = "Saving card...";
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/add-pairing-card`, {
            method:"POST",
            headers:{"Content-Type":"application/json",apikey:SUPABASE_PUBLISHABLE_KEY,
                Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`},
            body:JSON.stringify({password:verifiedPassword, card_id:pendingCardId})
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
        const savedId = pendingCardId;
        // Add the saved card locally immediately; other users pick it up on refresh.
        extraCardIds.add(savedId);
        if (!cardMap[savedId]) {
            cards.push({id:savedId, name:savedId, type:""});
            cards.sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric:true}));
            cardMap[savedId] = {id:savedId, name:savedId, type:""};
        }
        renderGalleryCards();
        renderSelectedCards();
        setStatus(`${cards.length} cards loaded.`);
        addCardModal.classList.add("hidden");
        pendingCardId = null;
        showStatusModal(`${savedId} is now available for everyone.`, false, "Card Added");
    } catch(error) {
        console.error(error);
        addCardFeedback.textContent = `Could not save to Supabase: ${error.message}. The preview works locally, but sharing requires the pairing_cards table and add-pairing-card Edge Function.`;
    } finally { databaseBusy = false; addCardConfirm.disabled = false; }
});

/* Remove a manually added card. This calls a password-protected Edge Function;
   no browser-side DELETE privilege or service role key is required. */
const manageCardsModal = document.getElementById("manage-cards-modal");
const manageCardSelect = document.getElementById("manage-card-select");
const manageCardPreview = document.getElementById("manage-card-preview");
const manageCardFeedback = document.getElementById("manage-card-feedback");
const manageCardDelete = document.getElementById("manage-card-delete");
const manageCardCancel = document.getElementById("manage-card-cancel");

function removableCardIds() {
    return [...extraCardIds].filter(id => !jsonCardIds.has(id)).sort();
}
function updateManageCardPreview() {
    const id = manageCardSelect.value;
    manageCardPreview.innerHTML = id ? cardImageHTML(id) : "";
    manageCardPreview.classList.toggle("hidden", !id);
    manageCardDelete.disabled = !id;
}
function openManageCards() {
    const ids = removableCardIds();
    manageCardSelect.replaceChildren();
    for (const id of ids) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = id;
        manageCardSelect.append(option);
    }
    manageCardFeedback.textContent = ids.length ? "Choose the card to remove." : "No manually added cards to remove.";
    updateManageCardPreview();
    addCardModal.classList.add("hidden");
    manageCardsModal.classList.remove("hidden");
}
document.getElementById("manage-added-cards").addEventListener("click", openManageCards);
manageCardSelect.addEventListener("change", updateManageCardPreview);
manageCardCancel.addEventListener("click", () => {
    if (!databaseBusy) manageCardsModal.classList.add("hidden");
});
manageCardDelete.addEventListener("click", async () => {
    const id = manageCardSelect.value;
    if (databaseBusy || !id || !extraCardIds.has(id) || jsonCardIds.has(id)) return;
    if (!window.confirm(`Permanently remove ${id} from the shared GD06 gallery?\n\nAll saved pairs containing this card will also be permanently deleted.`)) return;
    databaseBusy = true;
    manageCardDelete.disabled = true;
    manageCardFeedback.textContent = `Removing ${id}...`;
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-pairing-card`, {
            method:"POST",
            headers:{"Content-Type":"application/json", apikey:SUPABASE_PUBLISHABLE_KEY,
                Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`},
            body:JSON.stringify({password:verifiedPassword, card_id:id})
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
        // Reconcile from the server; the delete must actually succeed first.
        await refreshExtraCards();
        await loadPairings();
        if (selectedCard1?.id === id) selectedCard1 = null;
        if (selectedCard2?.id === id) selectedCard2 = null;
        renderSelectedCards();
        manageCardsModal.classList.add("hidden");
        showStatusModal(`${id} removed, along with ${result.pairs_deleted ?? 0} associated pair(s).`, false, "Card Removed");
    } catch (error) {
        console.error(error);
        manageCardFeedback.textContent = `Could not remove card: ${error.message}`;
    } finally {
        databaseBusy = false;
        manageCardDelete.disabled = false;
    }
});

/* Desktop mouse drag scrolling */
let dragActive = false;
let dragMoved = false;
let dragStartY = 0;
let dragStartScrollTop = 0;
let suppressCardClickUntil = 0;

cardGrid.addEventListener("pointerdown", event => {
    if (
        event.pointerType !== "mouse" ||
        event.button !== 0
    ) {
        return;
    }

    dragActive = true;
    dragMoved = false;
    dragStartY = event.clientY;
    dragStartScrollTop = cardGrid.scrollTop;
});

cardGrid.addEventListener("pointermove", event => {
    if (
        !dragActive ||
        event.pointerType !== "mouse"
    ) {
        return;
    }

    const deltaY = event.clientY - dragStartY;

    if (
        !dragMoved &&
        Math.abs(deltaY) > 4
    ) {
        dragMoved = true;
        cardGrid.classList.add("dragging");

        try {
            cardGrid.setPointerCapture(
                event.pointerId
            );
        }
        catch (_) {}
    }

    if (dragMoved) {
        event.preventDefault();
        cardGrid.scrollTop =
            dragStartScrollTop - deltaY;
    }
});

function finishDrag(event) {
    if (!dragActive) return;

    dragActive = false;
    cardGrid.classList.remove("dragging");

    if (dragMoved) {
        suppressCardClickUntil =
            Date.now() + 200;
    }

    try {
        if (
            cardGrid.hasPointerCapture(
                event.pointerId
            )
        ) {
            cardGrid.releasePointerCapture(
                event.pointerId
            );
        }
    }
    catch (_) {}
}

cardGrid.addEventListener("pointerup", finishDrag);
cardGrid.addEventListener("pointercancel", finishDrag);

/* Events */
homeButton.addEventListener("click", () => {
    window.location.href = "index.html";
});

modeToggle.addEventListener("click", () => {
    setMode(
        currentMode === "add"
            ? "delete"
            : "add"
    );
});

setSelect.addEventListener("change", () => {
    loadSet(setSelect.value);
});

createPairButton.addEventListener(
    "click",
    createPair
);

deletePairsBack.addEventListener("click", () => {
    showView(galleryView);
});

deleteConfirmBack.addEventListener("click", () => {
    if (deletePrimaryCard) {
        openDeletePairs(deletePrimaryCard);
    }
    else {
        showView(galleryView);
    }
});

deletePairButton.addEventListener(
    "click",
    deleteSelectedPair
);

statusModalOk.addEventListener(
    "click",
    closeStatusModal
);

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        !statusModal.classList.contains("hidden") &&
        !databaseBusy
    ) {
        closeStatusModal();
    }
});

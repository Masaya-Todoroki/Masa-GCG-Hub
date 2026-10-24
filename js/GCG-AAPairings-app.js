        backButton.addEventListener("click", goBack);
        searchInput.addEventListener("input", handleSearch);

        window.addEventListener("popstate", () => {
            loadSet(getSetFromUrl(), false);
        });

        document.addEventListener("keydown", event => {
            if (event.ctrlKey && event.shiftKey && event.code === "Digit6" && !event.repeat) {
                event.preventDefault();
                toggleHiddenSets();
            }
        });

        // On mobile, press and hold the page title for 3 seconds.
        // Pointer events also support a mouse hold on desktop.
        let titleHoldTimer = null;
        let titleHoldStart = null;
        let titleHoldTriggered = false;
        function cancelTitleHold() {
            clearTimeout(titleHoldTimer);
            titleHoldTimer = null;
            titleHoldStart = null;
        }
        pageTitle.style.touchAction = "pan-y";
        pageTitle.style.userSelect = "none";
        pageTitle.style.webkitUserSelect = "none";
        pageTitle.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            cancelTitleHold();
            titleHoldTriggered = false;
            titleHoldStart = { x: event.clientX, y: event.clientY };
            titleHoldTimer = setTimeout(() => {
                titleHoldTriggered = true;
                toggleHiddenSets();
                cancelTitleHold();
            }, 3000);
        });
        pageTitle.addEventListener("pointermove", event => {
            if (titleHoldStart && Math.hypot(event.clientX - titleHoldStart.x, event.clientY - titleHoldStart.y) > 12) {
                cancelTitleHold();
            }
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach(type =>
            pageTitle.addEventListener(type, cancelTitleHold)
        );
        pageTitle.addEventListener("contextmenu", event => {
            if (titleHoldTimer || titleHoldTriggered) event.preventDefault();
        });

        function init() {
            const urlSet = getSetFromUrl();
            const startingSet = SETS.find(set => set.code.toUpperCase() === urlSet) || SETS[0];
            loadSet(startingSet.code, false);
        }

        init();
    

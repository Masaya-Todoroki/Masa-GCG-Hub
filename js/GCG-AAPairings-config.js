/* =====================================================================
   GCG JAVASCRIPT — js/GCG-AAPairings-config.js
   CONFIGURATION / USER-EDITABLE SETTINGS
   Search this file for: const, let, CONFIG, URL, and asset paths.
   Do not move existing declarations without checking initialization
   order; this cleanup preserves existing runtime behaviour.
   ===================================================================== */
// Add sets here. Set hidden: true for unreleased sets.
// All paths, labels and titles are generated automatically.
const SET_CONFIG = [
    { code: "GD01", hidden: false },
    { code: "GD02", hidden: false },
    { code: "GD03", hidden: false },
    { code: "GD04", hidden: false },
    { code: "GD05", hidden: false },
    { code: "GD06", hidden: false },
    { code: "EB01", hidden: false }
];
const SETS = SET_CONFIG.map(({ code, hidden }) => ({
    code,
    hidden,
    label: code,
    title: `${code} - Alt Art Pairings`,
    csvUrl: `data/${code}Pairings.csv`,
    imageFolder: `images/${code}`
}));

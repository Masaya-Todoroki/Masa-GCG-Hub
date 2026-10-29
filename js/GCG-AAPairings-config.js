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
    

(() => {
  const input = document.getElementById('players');
  const tbody = document.getElementById('results');
  const roundsLabel = document.getElementById('rounds');
  const earliestLabel = document.getElementById('earliest');

  function calculate(n) {
    // This is a score-group abstraction, not a complete legal Swiss pairing search.
    // With an odd undefeated group, one player pairs down. A win leaves ceil(k/2)
    // undefeated; an upset leaves floor(k/2). In round one, an odd-player bye
    // remains undefeated, so an upset is not possible there.
    const total = Math.ceil(Math.log2(n));
    let unbeaten = n;
    const rows = [];
    let earliest = total;
    for (let round = 1; round <= total; round++) {
      const start = unbeaten;
      unbeaten = Math.ceil(start / 2);
      let comment = '';
      if (unbeaten === 1) {
        comment = 'Final round';
      } else if (round > 1 && start % 2 === 1) {
        const afterUpset = Math.floor(start / 2);
        const projectedTotal = round + Math.ceil(Math.log2(afterUpset));
        if (projectedTotal < total) {
          comment = projectedTotal === round ? 'Final round if pair-down loses' : `${projectedTotal} rounds total if pair-down loses`;
          earliest = Math.min(earliest, projectedTotal);
        }
      }
      rows.push({round, unbeaten, comment});
    }
    return {total, earliest, rows};
  }
  function render() {
    const n = Number(input.value);
    if (!Number.isSafeInteger(n) || n < 2 || n > 100000) {
      roundsLabel.textContent = '—'; earliestLabel.textContent = '—';
      tbody.innerHTML = '<tr><td colspan="3">Enter a whole number between 2 and 100,000.</td></tr>';
      return;
    }
    const data = calculate(n);
    roundsLabel.textContent = data.total;
    earliestLabel.textContent = data.earliest;
    tbody.replaceChildren(...data.rows.map(row => {
      const tr = document.createElement('tr');
      const cells = [row.round, row.unbeaten, row.comment];
      cells.forEach((value, index) => {
        const td = document.createElement('td');
        td.textContent = String(value);
        if (index === 2 && value) td.className = value === 'Final round' ? 'final' : 'conditional';
        tr.appendChild(td);
      });
      return tr;
    }));
  }
  input.addEventListener('input', render);
  render();
})();

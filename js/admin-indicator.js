(() => {
  const indicator = document.getElementById('gcg-admin-indicator');
  if (!indicator) return;
  const pairTab = document.getElementById('gcg-admin-pair-tab');
  const url = window.GCG_SUPABASE_URL;
  const key = window.GCG_SUPABASE_PUBLISHABLE_KEY;
  if (!window.supabase || !url || !key || !/^https:\/\/.+\.supabase\.co\/?$/.test(url) || key.startsWith('PASTE_')) return;
  const client = window.supabase.createClient(url, key);
  let checkNumber = 0;
  async function update() {
    const current = ++checkNumber;
    indicator.hidden = true;
    if (pairTab) pairTab.hidden = true;
    try {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user || current !== checkNumber) return;
      const { data: allowed, error: roleError } = await client.rpc('gcg_is_admin');
      if (current === checkNumber && !roleError && allowed === true) {
        indicator.hidden = false;
        if (pairTab) pairTab.hidden = false;
      }
    } catch (_) { indicator.hidden = true; if (pairTab) pairTab.hidden = true; }
  }
  client.auth.onAuthStateChange(() => { setTimeout(update, 0); });
  update();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();

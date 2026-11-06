(() => {
  const status = document.getElementById('status');
  const form = document.getElementById('login');
  const dashboard = document.getElementById('dashboard');
  const url = window.GCG_SUPABASE_URL;
  const key = window.GCG_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !/^https:\/\/.+\.supabase\.co\/?$/.test(url) || !key || key.startsWith('PASTE_') || !window.supabase) {
    status.textContent = 'Setup required: enter your public Supabase project URL and publishable/anon key in js/admin-config.js.';
    return;
  }
  const client = window.supabase.createClient(url, key);
  async function refresh() {
    form.hidden = true; dashboard.hidden = true;
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) { status.textContent = 'Sign in to manage the website.'; form.hidden = false; return; }
    const { data: allowed, error: roleError } = await client.rpc('gcg_is_admin');
    if (roleError || allowed !== true) {
      status.textContent = 'Signed in, but this account has no admin permission. Check the SQL setup instructions.';
      dashboard.hidden = false;
      dashboard.querySelector('p').textContent = 'This account is not authorised for admin controls.';
      return;
    }
    status.textContent = 'Administrator verified.';
    dashboard.hidden = false;
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); status.textContent = 'Signing in…';
    const { error } = await client.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
    document.getElementById('password').value = '';
    if (error) { status.textContent = error.message; return; }
    await refresh();
  });
  document.getElementById('signout').addEventListener('click', async () => { await client.auth.signOut(); await refresh(); });
  refresh().catch(() => { status.textContent = 'Unable to connect to Supabase.'; form.hidden = false; });
})();

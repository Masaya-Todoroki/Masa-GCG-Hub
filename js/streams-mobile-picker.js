// Mobile picker portal: keep existing picker event handlers and IDs intact.
// Moving an existing DOM node preserves all event listeners.
(() => {
  const picker = document.getElementById('chat-picker');
  if (!picker) return;
  const originalParent = picker.parentElement;
  const originalNext = picker.nextSibling;
  const sync = () => {
    if (window.matchMedia('(max-width: 700px)').matches) {
      if (picker.parentElement !== document.body) document.body.appendChild(picker);
    } else if (picker.parentElement !== originalParent) {
      originalParent.insertBefore(picker, originalNext);
    }
  };
  sync();
  window.addEventListener('resize', sync, { passive: true });
})();

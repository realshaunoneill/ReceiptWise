// Init script for taking the store screenshots of a local dev server (agent-browser --init-script):
// light theme, analytics declined, no staging banner or dev tools, and a made-up account email.
(() => {
  if (location.hostname !== 'localhost') return;
  try {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('rw-analytics-consent', 'denied');
  } catch {}

  const EMAIL = 'aoife.byrne@example.com';
  const replaceEmails = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.includes('@receiptwise.test')) node.nodeValue = node.nodeValue.replace(/[\w.+-]+@receiptwise\.test/g, EMAIL);
    }
    const avatar = document.querySelector('button[aria-label="Account menu"]');
    if (avatar && avatar.textContent.trim() === 'C') avatar.querySelectorAll('*').forEach((el) => { if (el.childElementCount === 0 && el.textContent.trim() === 'C') el.textContent = 'A'; });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = 'body > .bg-warning, .tsqd-parent-container, nextjs-portal, a[href="/admin"] { display: none !important; }';
    document.head.append(style);
    replaceEmails(document.body);
    new MutationObserver(() => replaceEmails(document.body)).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();

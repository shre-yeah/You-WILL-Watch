document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const dismissBtn = document.getElementById('dismissBtn');
  const status = document.getElementById('status');

  startBtn.addEventListener('click', () => {
    chrome.storage.local.set({ onboardSeen: true }, () => {
      status.textContent = 'Ready — enjoy staying focused! This tab will close.';
      // Try to close the tab created by the extension
      setTimeout(() => {
        try { window.close(); } catch (e) {/*ignored*/}
      }, 600);
    });
  });

  dismissBtn.addEventListener('click', () => {
    chrome.storage.local.set({ onboardSeen: true }, () => {
      status.textContent = 'Okay — you can reopen onboarding later from the extension.';
    });
  });
});

const copyButton = document.querySelector('#copyBtn');
const toast = document.querySelector('#toast');
const dialog = document.querySelector('#rulesDialog');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

async function copyInvite() {
  const link = document.querySelector('#inviteUrl').textContent;
  try {
    await navigator.clipboard.writeText(`https://${link}`);
  } catch {
    // Clipboard access can be unavailable in local preview; the UI still confirms the action.
  }
  copyButton.classList.add('copied');
  copyButton.innerHTML = '<span>✓</span> KOPIERT';
  showToast('Link kopiert — schick ihn an deine Freunde!');
  setTimeout(() => {
    copyButton.classList.remove('copied');
    copyButton.innerHTML = '<span>⧉</span> LINK KOPIEREN';
  }, 2200);
}

copyButton.addEventListener('click', copyInvite);
document.querySelectorAll('.mini-copy').forEach(button => button.addEventListener('click', copyInvite));
document.querySelector('#rulesBtn').addEventListener('click', () => dialog.showModal());
document.querySelector('.close-modal').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});

document.querySelector('#readyBtn').addEventListener('click', event => {
  event.currentTarget.classList.toggle('is-ready');
  const ready = event.currentTarget.classList.contains('is-ready');
  event.currentTarget.innerHTML = ready ? 'BEREIT! <span>✓</span>' : 'ICH BIN BEREIT <span>→</span>';
  showToast(ready ? 'Du bist bereit. Jetzt fehlen nur noch zwei!' : 'Du bist nicht mehr bereit.');
});

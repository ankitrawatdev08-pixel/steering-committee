/**
 * How To Play (Rules of Governance) Modal Controller
 */

export function initHowToPlay() {
  const modal = document.getElementById('modal-how-to-play');
  const openLandingBtn = document.getElementById('btn-open-rules');
  const openLobbyBtn = document.getElementById('btn-lobby-rules');
  const closeBtn = document.getElementById('btn-close-rules');
  const dismissBtn = document.getElementById('btn-dismiss-rules');

  if (!modal) return;

  function openModal() {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (openLandingBtn) openLandingBtn.addEventListener('click', openModal);
  if (openLobbyBtn) openLobbyBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (dismissBtn) dismissBtn.addEventListener('click', closeModal);

  // Close on backdrop tap
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

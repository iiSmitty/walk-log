// Install banner
let deferredPrompt = null;
const banner     = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('installDismiss');

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem('walklog_install_dismissed')) {
        banner.classList.add('show');
    }
});

installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.classList.remove('show');
});

dismissBtn.addEventListener('click', () => {
    banner.classList.remove('show');
    localStorage.setItem('walklog_install_dismissed', '1');
});

window.addEventListener('appinstalled', () => banner.classList.remove('show'));
// Inject manifest as a blob so it works from a plain file server
const manifest = {
    name: 'Walk Log',
    short_name: 'Walk Log',
    start_url: '.',
    display: 'standalone',
    background_color: '#f5f0e8',
    theme_color: '#1a1612',
    icons: [{
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='112' fill='%231a1612'/%3E%3Ctext x='256' y='330' font-size='280' text-anchor='middle' font-family='serif' fill='%23b8926a'%3E&#x1F6B6;%3C/text%3E%3C/svg%3E",
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable'
    }]
};
const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
document.getElementById('manifestLink').href = URL.createObjectURL(manifestBlob);

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
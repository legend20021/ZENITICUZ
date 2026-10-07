(() => {
    'use strict';
    window.lucide?.createIcons({ attrs: { 'stroke-width': 1.9 } });
    const form = document.querySelector('#login-form');
    const alertBox = document.querySelector('#login-alert');
    const storedPassword = () => localStorage.getItem('zenit-password') || 'admin';

    document.querySelectorAll('[data-toggle-password]').forEach(button => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.togglePassword);
            input.type = input.type === 'password' ? 'text' : 'password';
            button.setAttribute('aria-label', input.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
        });
    });

    form?.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        const valid = String(data.get('username')).trim() === 'admin' && String(data.get('password')) === storedPassword();
        alertBox.hidden = valid;
        if (!valid) {
            form.animate([{ transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }], { duration: 260 });
            return;
        }
        localStorage.setItem('zenit-session', 'active');
        window.location.href = 'index.html#dashboard';
    });
})();

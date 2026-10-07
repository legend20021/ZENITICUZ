(() => {
    'use strict';

    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
    const state = {
        activeView: 'dashboard',
        process: 'idle',
        seconds: 0,
        processInterval: null,
        simulationInterval: null,
        chart: null,
        appStarted: false,
        logs: [
            ['Hoy · 10:24:36', 'Plataforma iniciada', 'Sistema', 'admin', 'Completado'],
            ['Hoy · 10:20:08', 'Proceso detenido', 'Proceso', 'admin', 'Informativo'],
            ['Ayer · 18:42:19', 'Contraseña actualizada', 'Seguridad', 'admin', 'Completado'],
            ['Ayer · 17:05:41', 'Conexión WiFi perdida', 'Sistema', 'Sistema', 'Advertencia'],
        ],
    };

    const iconRefresh = () => window.lucide?.createIcons({ attrs: { 'stroke-width': 1.9 } });

    function toast(message, type = 'success') {
        const region = $('#toast-region');
        if (!region) return;
        const item = document.createElement('div');
        item.className = `toast ${type}`;
        item.innerHTML = `<i data-lucide="${type === 'error' ? 'circle-alert' : 'circle-check'}"></i><span>${message}</span>`;
        region.append(item);
        iconRefresh();
        setTimeout(() => item.remove(), 3600);
    }

    function addLog(event, type = 'Proceso', status = 'Completado') {
        const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
        state.logs.unshift([`Hoy · ${time}`, event, type, 'admin', status]);
        renderLogs();
    }

    function renderLogs() {
        const body = $('#log-table');
        if (!body) return;
        const query = ($('#log-search')?.value || '').toLowerCase();
        const filter = $('#log-filter')?.value || 'all';
        body.innerHTML = state.logs
            .filter(row => (filter === 'all' || row[2] === filter) && row.join(' ').toLowerCase().includes(query))
            .map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>_<span>${row[2]}</span></td><td>${row[3]}</td><td><b class="status-badge ${row[4] === 'Completado' ? 'success' : row[4] === 'Advertencia' ? 'warning' : ''}">${row[4]}</b></td></tr>`)
            .join('');
    }

    function setView(view) {
        if (!$(`[data-view="${view}"]`)) view = 'dashboard';
        state.activeView = view;
        $$('.app-view').forEach(section => section.classList.toggle('active', section.dataset.view === view));
        $$('[data-view-target]').forEach(button => button.classList.toggle('active', button.dataset.viewTarget === view));
        document.title = `${viewTitle(view)} · ZENIT ICUZ`;
        window.history.replaceState(null, '', `#${view}`);
        closeSidebar();
        closeMoreSheet();
        if (view === 'curves') requestAnimationFrame(initChart);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        iconRefresh();
    }

    const viewTitle = view => ({ dashboard: 'Dashboard', recipes: 'Recetas', curves: 'Curvas', wifi: 'WiFi', diagnostics: 'Diagnóstico', help: 'Ayuda', logs: 'Logs', updates: 'Actualizaciones', profile: 'Mi perfil' }[view] || 'Dashboard');

    function openSidebar() { $('#sidebar')?.classList.add('open'); $('#sidebar-backdrop')?.classList.add('open'); }
    function closeSidebar() { $('#sidebar')?.classList.remove('open'); $('#sidebar-backdrop')?.classList.remove('open'); }
    function closeMoreSheet() { $('#more-sheet')?.classList.remove('open'); $('#more-sheet')?.setAttribute('aria-hidden', 'true'); }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('zenit-theme', theme);
        $('#theme-toggle')?.classList.toggle('on', theme === 'dark');
        if (state.chart) updateChartTheme();
    }

    function updateClock() {
        const now = new Date();
        const date = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(now);
        const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
        if ($('#current-date')) $('#current-date').textContent = date;
        if ($('#current-time')) $('#current-time').textContent = time;
    }

    function formatDuration(total) {
        const hours = Math.floor(total / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
        return `${hours} hrs : ${minutes} min`;
    }

    function setPumpActive(active, label = active ? 'Activa' : 'Detenida') {
        const card = $('.level-card');
        const pump = $('#pump-state');
        const machine = $('#pump-machine');
        card?.classList.toggle('pump-on', active);
        if (pump) pump.innerHTML = label;
        if (machine) machine.setAttribute('aria-label', active ? 'Bomba encendida' : 'Bomba detenida');
        if ($('#pump-toggle')) $('#pump-toggle').checked = active;
    }

    function setProcess(action) {
        const time = $('#process-time');
        const label = $('#process-state');
        clearInterval(state.processInterval);
        state.processInterval = null;

        if (action === 'start') {
            state.process = 'running';
            label.textContent = 'Proceso activo · datos simulados';
            setPumpActive(true);
            $('.paused-pill').innerHTML = '<span></span>Proceso activo <i data-lucide="activity"></i>';
            $('.paused-pill').style.background = 'linear-gradient(90deg,#e5faed,#d2f4e2)';
            $('.paused-pill').classList.add('live');
            state.processInterval = setInterval(() => { state.seconds += 1; time.textContent = formatDuration(state.seconds); }, 1000);
            startSimulation(true, true);
            addLog('Proceso iniciado', 'Proceso');
            toast('Proceso iniciado correctamente.');
        } else if (action === 'stop') {
            state.process = 'paused';
            const simulationActive = $('#simulation-toggle')?.classList.contains('on');
            label.textContent = simulationActive ? 'Proceso detenido · simulación activa' : 'Proceso detenido por el usuario';
            setPumpActive(simulationActive);
            addLog('Proceso detenido', 'Proceso', 'Informativo');
            toast('Proceso detenido.', 'success');
        } else {
            state.process = 'idle';
            state.seconds = 0;
            time.textContent = formatDuration(0);
            const simulationActive = $('#simulation-toggle')?.classList.contains('on');
            label.textContent = simulationActive ? 'Simulación activa · datos dinámicos' : 'Sin conexión · datos pausados';
            setPumpActive(simulationActive);
            addLog('Proceso cancelado y reiniciado', 'Proceso', 'Advertencia');
            toast('Proceso cancelado y temporizador reiniciado.', 'error');
        }
        iconRefresh();
    }

    function randomBetween(min, max, decimals = 1) { return (Math.random() * (max - min) + min).toFixed(decimals); }

    function updateTelemetry() {
        const values = {
            '#pressure-value': `${randomBetween(.1, 1.8)} PSI`,
            '#ph-value': randomBetween(7.2, 8.1),
            '#mass-temp': `${randomBetween(25.2, 27.4)}°C`,
            '#leach-temp': `${randomBetween(24.6, 26.3)}°C`,
        };
        Object.entries(values).forEach(([selector, value]) => { const element = $(selector); if (element) element.textContent = value; });
        $$('.telemetry-card').forEach((card, index) => setTimeout(() => { card.animate([{ transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], { duration: 300 }); }, index * 45));
        appendChartPoint();
    }

    function startSimulation(forceOn = false, silent = false) {
        const button = $('#simulation-toggle');
        const shouldEnable = forceOn || !button.classList.contains('on');
        button.classList.toggle('on', shouldEnable);
        clearInterval(state.simulationInterval);
        state.simulationInterval = null;
        if (shouldEnable) {
            setPumpActive(true);
            if (state.process !== 'running') {
                $('#process-state').textContent = 'Simulación activa · datos dinámicos';
                $('.paused-pill').innerHTML = '<span></span>Simulación activa <i data-lucide="activity"></i>';
                $('.paused-pill').style.background = 'linear-gradient(90deg,#e5faed,#d2f4e2)';
                $('.paused-pill').classList.add('live');
            }
            updateTelemetry();
            state.simulationInterval = setInterval(updateTelemetry, 5000);
            $('#connection-pill')?.classList.add('connected');
            $('#connection-pill span').textContent = 'Simulación activa';
            if (!silent) toast('Simulación activada. Las lecturas variarán cada 5 segundos.');
        } else {
            if (state.process !== 'running') {
                setPumpActive(false);
                $('#process-state').textContent = 'Sin conexión · datos pausados';
                $('.paused-pill').innerHTML = '<span></span>Datos pausados <i data-lucide="info"></i>';
                $('.paused-pill').style.background = '';
                $('.paused-pill').classList.remove('live');
            }
            $('#connection-pill')?.classList.remove('connected');
            $('#connection-pill span').textContent = 'Sin conexión';
            if (!silent) toast('Simulación pausada.');
        }
        iconRefresh();
    }

    const chartData = {
        labels: ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'],
        temperature: [24.8,25.1,25.5,25.8,26.1,26.4,26.2,25.9,25.7,25.6,25.8,25.9],
        ph: [7.2,7.3,7.5,7.6,7.8,7.9,7.8,7.7,7.7,7.8,7.9,7.9],
        pressure: [.1,.2,.3,.6,.8,1.1,1.4,1.3,1.0,.7,.3,.1],
    };

    function initChart() {
        const canvas = $('#process-chart');
        if (!canvas || typeof Chart === 'undefined') return;
        if (state.chart) { state.chart.resize(); return; }
        const dark = document.documentElement.dataset.theme === 'dark';
        state.chart = new Chart(canvas, {
            type: 'line',
            data: { labels: chartData.labels, datasets: [
                { label: 'Temperatura °C', data: chartData.temperature, borderColor: '#f59e42', backgroundColor: 'rgba(245,158,66,.12)', tension: .42, fill: true, pointRadius: 2, yAxisID: 'y' },
                { label: 'pH', data: chartData.ph, borderColor: '#13a777', backgroundColor: 'rgba(19,167,119,.08)', tension: .42, pointRadius: 2, yAxisID: 'y1' },
                { label: 'Presión PSI', data: chartData.pressure, borderColor: '#2a92e8', tension: .42, pointRadius: 2, yAxisID: 'y1' },
            ]},
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: dark ? '#d9e9f4' : '#50677d', usePointStyle: true, boxWidth: 8 } } }, scales: { x: { grid: { color: dark ? 'rgba(150,180,200,.1)' : 'rgba(80,110,140,.08)' }, ticks: { color: dark ? '#9db2c4' : '#607893' } }, y: { position: 'left', grid: { color: dark ? 'rgba(150,180,200,.1)' : 'rgba(80,110,140,.08)' }, ticks: { color: dark ? '#9db2c4' : '#607893' } }, y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: dark ? '#9db2c4' : '#607893' } } } }
        });
    }

    function updateChartTheme() {
        if (!state.chart) return;
        const color = document.documentElement.dataset.theme === 'dark' ? '#9db2c4' : '#607893';
        state.chart.options.plugins.legend.labels.color = color;
        Object.values(state.chart.options.scales).forEach(scale => { scale.ticks.color = color; });
        state.chart.update();
    }

    function appendChartPoint() {
        if (!state.chart) return;
        const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date());
        state.chart.data.labels.push(time);
        state.chart.data.datasets[0].data.push(+randomBetween(25.1, 27.2));
        state.chart.data.datasets[1].data.push(+randomBetween(7.2, 8.1));
        state.chart.data.datasets[2].data.push(+randomBetween(.1, 1.8));
        if (state.chart.data.labels.length > 14) { state.chart.data.labels.shift(); state.chart.data.datasets.forEach(d => d.data.shift()); }
        state.chart.update('none');
    }

    function openModal(modal) { modal?.classList.add('open'); modal?.setAttribute('aria-hidden', 'false'); }
    function closeModal(modal) { modal?.classList.remove('open'); modal?.setAttribute('aria-hidden', 'true'); }

    function bindEvents() {
        $$('[data-view-target]').forEach(button => button.addEventListener('click', () => setView(button.dataset.viewTarget)));
        $('#menu-button')?.addEventListener('click', openSidebar);
        $('#sidebar-backdrop')?.addEventListener('click', closeSidebar);
        $('#more-button')?.addEventListener('click', () => { const sheet = $('#more-sheet'); const open = !sheet.classList.contains('open'); sheet.classList.toggle('open', open); sheet.setAttribute('aria-hidden', String(!open)); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeSidebar(); closeMoreSheet(); $$('.modal.open').forEach(closeModal); } });
        $('#theme-toggle')?.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
        $('#simulation-toggle')?.addEventListener('click', () => startSimulation(false));
        $('#pump-toggle')?.addEventListener('change', event => {
            const active = event.target.checked;
            if (!active && $('#simulation-toggle')?.classList.contains('on')) {
                setPumpActive(true);
                toast('La bomba permanece activa durante la simulación.');
                return;
            }
            setPumpActive(active);
            addLog(active ? 'Bomba activada manualmente' : 'Bomba detenida manualmente', 'Proceso', active ? 'Completado' : 'Informativo');
            toast(active ? 'Bomba activada.' : 'Bomba detenida.');
        });
        $$('.process-action').forEach(button => button.addEventListener('click', () => setProcess(button.dataset.processAction)));
        $('#high-level')?.addEventListener('change', event => { toast(event.target.checked ? 'Alarma de nivel alto activada.' : 'Alarma de nivel alto desactivada.'); addLog('Cambio en sensor de nivel alto', 'Sistema'); });
        $('#low-level')?.addEventListener('change', event => { toast(event.target.checked ? 'Alarma de nivel bajo activada.' : 'Alarma de nivel bajo desactivada.'); addLog('Cambio en sensor de nivel bajo', 'Sistema'); });
        $$('.recipe-start').forEach(button => button.addEventListener('click', event => { const name = event.currentTarget.closest('.recipe-card').querySelector('h3').textContent; setView('dashboard'); setProcess('start'); toast(`Receta “${name}” aplicada.`); addLog(`Receta aplicada: ${name}`, 'Proceso'); }));
        $('#new-recipe')?.addEventListener('click', () => openModal($('#recipe-modal')));
        $$('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
        $$('.modal').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));
        $('#recipe-form')?.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const article = document.createElement('article'); article.className = 'recipe-card'; article.innerHTML = `<div class="recipe-top"><span class="recipe-icon violet"><i data-lucide="sparkles"></i></span><span class="status-badge">Nueva</span></div><h3>${escapeHtml(data.get('name'))}</h3><p>Receta personalizada creada por el administrador.</p><dl><div><dt>Duración</dt><dd>${escapeHtml(data.get('duration'))} h</dd></div><div><dt>Temperatura</dt><dd>${escapeHtml(data.get('temperature'))}°C</dd></div><div><dt>pH objetivo</dt><dd>${escapeHtml(data.get('ph'))}</dd></div></dl><button class="secondary-button recipe-start"><i data-lucide="play"></i>Usar receta</button>`; $('#recipe-grid').prepend(article); article.querySelector('.recipe-start').addEventListener('click', () => { setView('dashboard'); setProcess('start'); }); closeModal($('#recipe-modal')); iconRefresh(); toast('Receta creada correctamente.'); addLog(`Receta creada: ${data.get('name')}`, 'Proceso'); event.currentTarget.reset(); });
        $$('.segmented button').forEach(button => button.addEventListener('click', () => { $$('.segmented button').forEach(b => b.classList.remove('active')); button.classList.add('active'); if (state.chart) { const factor = +button.dataset.range / 24; state.chart.data.datasets.forEach((d, index) => d.data = d.data.map(value => +(value + (Math.random() - .5) * factor * (index === 0 ? .5 : .12)).toFixed(2))); state.chart.update(); } }));
        $('#download-chart')?.addEventListener('click', () => { if (!state.chart) return; const link = document.createElement('a'); link.download = 'curvas-fermentacion.png'; link.href = state.chart.toBase64Image('image/png', 1); link.click(); toast('Gráfico exportado como PNG.'); });
        $('#scan-networks')?.addEventListener('click', event => { event.currentTarget.disabled = true; $('#scan-state').textContent = 'Buscando redes…'; $('#network-list').classList.add('is-loading'); setTimeout(() => { event.currentTarget.disabled = false; $('#scan-state').textContent = 'Último escaneo: ahora'; $('#network-list').classList.remove('is-loading'); toast('Escaneo completado: 3 redes encontradas.'); }, 1500); });
        $$('.network').forEach(network => network.addEventListener('click', () => { $$('.network').forEach(n => n.classList.remove('active')); network.classList.add('active'); }));
        $('#wifi-form')?.addEventListener('submit', event => { event.preventDefault(); const selected = $('.network.active strong')?.textContent || 'red seleccionada'; const button = event.currentTarget.querySelector('button'); button.disabled = true; button.innerHTML = '<i data-lucide="loader-circle"></i>Conectando'; iconRefresh(); setTimeout(() => { button.disabled = false; button.innerHTML = '<i data-lucide="link"></i>Conectar'; $('#connection-pill span').textContent = selected; $('#connection-pill').classList.add('connected'); iconRefresh(); toast(`Conexión establecida con ${selected}.`); addLog(`WiFi conectado: ${selected}`, 'Sistema'); }, 1600); });
        $('#run-diagnostics')?.addEventListener('click', event => { const cards = $$('[data-check]'); event.currentTarget.disabled = true; cards.forEach((card, index) => { card.classList.add('running'); const status = $('.check-status', card); status.innerHTML = '<i data-lucide="loader-circle"></i>Comprobando'; setTimeout(() => { card.classList.remove('running'); status.className = `check-status ${index === 3 ? 'warning' : 'success'}`; status.innerHTML = `<i data-lucide="${index === 3 ? 'triangle-alert' : 'circle-check'}"></i>${index === 3 ? 'Atención' : 'Correcto'}`; iconRefresh(); if (index === cards.length - 1) { event.currentTarget.disabled = false; toast('Diagnóstico finalizado.'); addLog('Diagnóstico completo ejecutado', 'Sistema'); } }, 600 + index * 500); }); iconRefresh(); });
        $$('.faq').forEach(faq => faq.addEventListener('click', () => faq.classList.toggle('open')));
        $('#help-search')?.addEventListener('input', event => { const query = event.target.value.toLowerCase(); $$('.faq').forEach(faq => faq.hidden = !faq.textContent.toLowerCase().includes(query)); });
        $('#log-search')?.addEventListener('input', renderLogs); $('#log-filter')?.addEventListener('change', renderLogs);
        $('#export-logs')?.addEventListener('click', exportLogs);
        $('#check-updates')?.addEventListener('click', event => { const original = event.currentTarget.innerHTML; event.currentTarget.innerHTML = '<i data-lucide="loader-circle"></i>Buscando…'; event.currentTarget.disabled = true; iconRefresh(); setTimeout(() => { event.currentTarget.innerHTML = original; event.currentTarget.disabled = false; iconRefresh(); toast('Ya tienes la versión más reciente.'); addLog('Búsqueda de actualizaciones', 'Sistema'); }, 1400); });
        $('#profile-form')?.addEventListener('submit', updateProfile);
        $('#logout-link')?.addEventListener('click', event => { event.preventDefault(); localStorage.removeItem('zenit-session'); showLogin(); });
    }

    function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }

    function exportLogs() {
        const rows = [['Fecha y hora','Evento','Tipo','Usuario','Estado'], ...state.logs];
        const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'zenit-logs.csv'; link.click(); URL.revokeObjectURL(url); toast('Registro exportado como CSV.');
    }

    function updateProfile(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const data = Object.fromEntries(new FormData(form).entries());
        button.disabled = true;
        try {
            const currentPassword = localStorage.getItem('zenit-password') || 'admin';
            const newPassword = String(data.new_password || '');
            if (newPassword) {
                if (String(data.current_password || '') !== currentPassword) throw new Error('La contraseña actual no es correcta.');
                if (newPassword.length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
                if (newPassword !== String(data.confirm_password || '')) throw new Error('Las contraseñas nuevas no coinciden.');
                localStorage.setItem('zenit-password', newPassword);
            }
            const displayName = String(data.display_name || 'Administrador').trim() || 'Administrador';
            localStorage.setItem('zenit-display-name', displayName);
            $('#profile-summary-name').textContent = displayName;
            $('#profile-avatar').textContent = displayName.charAt(0).toUpperCase();
            $('#profile-initial').textContent = displayName.charAt(0).toUpperCase();
            document.body.dataset.userName = displayName;
            form.querySelector('[name="current_password"]').value = '';
            form.querySelector('[name="new_password"]').value = '';
            form.querySelector('[name="confirm_password"]').value = '';
            toast(newPassword ? 'Perfil y contraseña local actualizados.' : 'Perfil actualizado correctamente.');
            addLog('Perfil actualizado', 'Seguridad');
        } catch (error) { toast(error.message, 'error'); }
        finally { button.disabled = false; }
    }

    // --- Login / vista única dentro de index.html ---

    function showLogin() {
        document.body.classList.add('login-body');
        document.body.classList.remove('app-body');
        const login = $('#login-screen');
        const app = $('#app-screen');
        if (login) login.hidden = false;
        if (app) app.hidden = true;
        iconRefresh();
    }

    function showApp() {
        document.body.classList.remove('login-body');
        document.body.classList.add('app-body');
        const login = $('#login-screen');
        const app = $('#app-screen');
        if (login) login.hidden = true;
        if (app) app.hidden = false;
    }

    function initLoginForm() {
        const form = $('#login-form');
        const alertBox = $('#login-alert');
        const storedPassword = () => localStorage.getItem('zenit-password') || 'admin';

        $$('[data-toggle-password]').forEach(button => {
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
            showApp();
            startApp();
            window.location.hash = 'dashboard';
        });
    }

    function startApp() {
        if (state.appStarted) return;
        state.appStarted = true;
        const displayName = localStorage.getItem('zenit-display-name') || 'Administrador';
        document.body.dataset.userName = displayName;
        $('#profile-summary-name').textContent = displayName;
        $('#profile-avatar').textContent = displayName.charAt(0).toUpperCase();
        $('#profile-initial').textContent = displayName.charAt(0).toUpperCase();
        const nameInput = $('#profile-form [name="display_name"]');
        if (nameInput) nameInput.value = displayName;
        applyTheme(localStorage.getItem('zenit-theme') || 'light');
        iconRefresh();
        updateClock();
        setInterval(updateClock, 1000);
        bindEvents();
        renderLogs();
        startSimulation(true, true);
        const initial = location.hash.replace('#', '') || 'dashboard';
        setView(initial);
        const cards = $$('[data-animate-card]');
        cards.forEach((card, index) => card.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 460, delay: index * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }));
    }

    function init() {
        iconRefresh();
        initLoginForm();
        if (localStorage.getItem('zenit-session') === 'active') {
            showApp();
            startApp();
        } else {
            showLogin();
        }
    }

    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();

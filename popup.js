// popup.js
const FB_ID = '61580707185120';
const FB_URL = `https://www.facebook.com/profile.php?id=${FB_ID}`;
const PAGASA_URL = 'https://www.pagasa.dost.gov.ph/regional-forecast/minprsd';
const CHECK_INTERVAL_MINS = 5;

let nextCheckAt = null;
let countdownTimer = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  startCountdown();

  document.getElementById('btnRefresh').addEventListener('click', doFetch);
  document.getElementById('btnFetch').addEventListener('click', doFetch);
  document.getElementById('btnOpenPagasa').addEventListener('click', () => chrome.tabs.create({ url: PAGASA_URL }));
  document.getElementById('btnOpenFB').addEventListener('click', () => chrome.tabs.create({ url: FB_URL }));
  document.getElementById('btnSpeak').addEventListener('click', testSpeak);
  document.getElementById('btnClear').addEventListener('click', clearAll);
  document.getElementById('footerLink').addEventListener('click', e => {
    e.preventDefault(); chrome.tabs.create({ url: PAGASA_URL });
  });
});

function loadAll() {
  chrome.storage.local.get(['lastAlerts', 'freshStatus', 'lastPagasaStatus'], r => {
    if (r.lastAlerts) renderAlerts(r.lastAlerts);
    if (r.freshStatus) renderLivePanel(r.freshStatus);
    else renderLivePanelLoading();
    setStatus('active', 'Monitoring active — fetching every 5 min');
  });
  // Also check if alarm exists
  chrome.alarms.get('pagasaCheck', a => {
    if (a) {
      nextCheckAt = a.scheduledTime;
    }
  });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
function doFetch() {
  const btn = document.getElementById('btnRefresh');
  const btn2 = document.getElementById('btnFetch');
  btn.classList.add('spinning');
  btn2.textContent = '⟳ Fetching...';
  btn2.disabled = true;
  setStatus('active', 'Fetching from pagasa.dost.gov.ph...');

  chrome.runtime.sendMessage({ action: 'MANUAL_FETCH' }, (result) => {
    btn.classList.remove('spinning');
    btn2.textContent = '⟳ Fetch Now';
    btn2.disabled = false;

    if (result && result.ok) {
      setStatus('active', 'Fetch successful — data updated');
      // reload from storage after background processes it
      setTimeout(() => {
        chrome.storage.local.get(['lastAlerts', 'freshStatus'], r => {
          if (r.freshStatus) renderLivePanel(r.freshStatus);
          if (r.lastAlerts) renderAlerts(r.lastAlerts);
        });
      }, 800);
    } else {
      setStatus('error', `Fetch failed: ${result?.error || 'Unknown error'}`);
    }

    // Reset countdown
    chrome.alarms.get('pagasaCheck', a => { if (a) nextCheckAt = a.scheduledTime; });
  });
}

// ─── Live Panel ───────────────────────────────────────────────────────────────
function renderLivePanelLoading() {
  ['cellRain','cellThunder','cellSpecial'].forEach(id => {
    setCell(id, 'loading', 'Checking...', '');
  });
}

function renderLivePanel(status) {
  // Rainfall
  if (status.rainfall) {
    if (status.rainfall.active) {
      setCell('cellRain', 'active', '⚠️ ACTIVE', status.rainfall.text ? status.rainfall.text.substring(0,80) : '');
    } else {
      setCell('cellRain', 'clear', '✅ No Warning', '');
    }
  } else {
    setCell('cellRain', 'clear', '✅ No Warning', '');
  }

  // Thunderstorm
  if (status.thunderstorm) {
    if (status.thunderstorm.active) {
      setCell('cellThunder', 'active', '⚠️ ACTIVE', status.thunderstorm.text ? status.thunderstorm.text.substring(0,80) : '');
    } else {
      setCell('cellThunder', 'clear', '✅ No Advisory', '');
    }
  } else {
    setCell('cellThunder', 'clear', '✅ No Advisory', '');
  }

  // Special
  if (status.special) {
    if (status.special.active) {
      setCell('cellSpecial', 'active', '⚠️ ACTIVE', status.special.text ? status.special.text.substring(0,80) : '');
    } else {
      setCell('cellSpecial', 'clear', '✅ None', '');
    }
  } else {
    setCell('cellSpecial', 'clear', '✅ None', '');
  }

  // Issued At
  const issuedEl = document.getElementById('issuedAt');
  issuedEl.textContent = status.issuedAt || status.fetchedAt || '—';

  // Footer time
  document.getElementById('footerTime').textContent = `Fetched: ${status.fetchedAt || '—'}`;

  // City badge
  const cityEl = document.getElementById('cityBadge');
  if (status.cityIncluded) {
    cityEl.className = 'city-badge city-yes';
    cityEl.textContent = '✅ El Salvador City — INCLUDED';
  } else {
    cityEl.className = 'city-badge city-no';
    cityEl.textContent = '❌ El Salvador City — not mentioned';
  }
}

function setCell(id, state, label, detail) {
  const el = document.getElementById(id);
  const detailEl = document.getElementById(id + 'Detail');
  el.className = 'cell-status ' + state;
  el.textContent = label;
  if (detailEl) detailEl.textContent = detail || '';
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function renderAlerts(alerts) {
  const list = document.getElementById('alertsList');
  const badge = document.getElementById('alertBadge');
  badge.textContent = alerts.length;
  badge.className = 'badge' + (alerts.length === 0 ? ' zero' : '');

  if (!alerts || alerts.length === 0) {
    list.innerHTML = `<div class="empty"><div class="ei">🛰️</div><p>No advisories logged yet.<br>PAGASA data is fetched automatically<br>every 5 minutes from pagasa.dost.gov.ph</p></div>`;
    return;
  }
  list.innerHTML = alerts.map(cardHTML).join('');
}

function cardForType(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('thunderstorm advisory')) return 'ta';
  if (t.includes('thunderstorm watch')) return 'tw';
  if (t.includes('rainfall') || t.includes('rain')) return 'ra';
  if (t.includes('special')) return 'sf';
  return 'wa';
}

function cardHTML(a) {
  const cls = cardForType(a.type);
  const num = a.number ? `<span class="mtag num">#${esc(a.number)}</span>` : '';
  const tim = a.time ? `<span class="mtag tim">🕐 ${esc(a.time)}</span>` : '';
  const src = a.source ? `<span class="mtag src">${esc(a.source)}</span>` : '';
  const city = a.cityIncluded
    ? `<span class="acity yes">✅ El Salvador City — INCLUDED</span>`
    : `<span class="acity no">❌ El Salvador City — not mentioned</span>`;
  return `
<div class="acard ${cls}">
  <div class="atype">⚠️ ${esc(a.type)}</div>
  <div class="ameta">${num}${tim}${src}</div>
  ${a.description ? `<div class="adesc">${esc(a.description)}</div>` : ''}
  ${city}
  <div class="atime">Logged: ${esc(a.detectedAt || '')}</div>
</div>`;
}

// ─── Status ───────────────────────────────────────────────────────────────────
function setStatus(type, text) {
  const dot = document.getElementById('sDot');
  const label = document.getElementById('sText');
  dot.className = 'status-dot ' + (type === 'active' ? 's-active' : type === 'error' ? 's-error' : 's-idle');
  label.textContent = text;
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (!nextCheckAt) {
      chrome.alarms.get('pagasaCheck', a => { if (a) nextCheckAt = a.scheduledTime; });
      return;
    }
    const secsLeft = Math.max(0, Math.round((nextCheckAt - Date.now()) / 1000));
    const m = Math.floor(secsLeft / 60);
    const s = secsLeft % 60;
    document.getElementById('countdown').textContent = `next: ${m}:${String(s).padStart(2,'0')}`;
  }, 1000);
}

// ─── Voice ────────────────────────────────────────────────────────────────────
function testSpeak() {
  const text = 'PAGASA Thunderstorm Advisory detected. Advisory number 5. Issued at 11:00 AM PHT. Moderate to occasionally heavy rainshowers with lightning and strong winds. City of El Salvador is included in this advisory.';
  chrome.tabs.query({ url: `${FB_URL}*` }, tabs => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'SPEAK', text });
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9; window.speechSynthesis.speak(u);
    }
  });
}

// ─── Clear ────────────────────────────────────────────────────────────────────
function clearAll() {
  chrome.runtime.sendMessage({ action: 'CLEAR_ALERTS' }, () => renderAlerts([]));
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
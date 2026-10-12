// popup-panel.js — PAGASA MINPRSD Side Panel v3.4

const PAGASA_URL = 'https://www.pagasa.dost.gov.ph/regional-forecast/minprsd';

// ── Clock ──────────────────────────────────────────────────────────────────
function tickClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour:   '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  el.textContent = fmt.format(now);
}

setInterval(tickClock, 1000);

// ── Storage listener ───────────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pagasaStatus) {
    renderAll(changes.pagasaStatus.newValue);
  }
});

function loadPanel() {
  chrome.storage.local.get(['pagasaStatus'], (result) => {
    if (result.pagasaStatus) {
      renderAll(result.pagasaStatus);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  tickClock();

  document.getElementById('btnOpen').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_PAGASA_TAB' });
  });
  document.getElementById('btnClear').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_ALERTS' });
    resetAll();
  });

  loadPanel();
});

// ── Render ─────────────────────────────────────────────────────────────────
function renderAll(data) {
  if (!data) return;

  const issuedVal = document.getElementById('issuedVal');
  if (issuedVal) issuedVal.textContent = data.issuedAt || data.fetchedAt || '—';

  renderAdvisory('rain',    data.rainfall,     'No Warning',  'No active rainfall warning.');
  
  // Thunderstorm display logic
  const thunderDisplay = (data.thunderstorm && data.thunderstorm.active)
    ? data.thunderstorm
    : (data.thunderstormWatch && data.thunderstormWatch.active ? data.thunderstormWatch : data.thunderstorm);
  
  renderAdvisory('thunder', thunderDisplay, 'No Warning', 'No active thunderstorm warning.');
  
  if (data.thunderstorm && data.thunderstorm.active && data.thunderstormWatch && data.thunderstormWatch.active) {
    renderWatchBanner(data.thunderstormWatch);
  } else {
    removeWatchBanner();
  }
  
  renderAdvisory('special', data.special,      'None',        'No special forecast at this time.');

  // City banner
  const cityBanner = document.getElementById('cityBanner');
  const cityText   = document.getElementById('cityBannerText');
  if (!cityBanner || !cityText) return;

  const mo = data.misamisOrientalIncluded;
  const es = data.elSalvadorIncluded;
  if (mo && es) {
    cityBanner.className = 'bn-danger';
    cityText.textContent = '⚠ MISAMIS ORIENTAL & EL SALVADOR CITY — BOTH ACTIVE';
  } else if (mo) {
    cityBanner.className = 'bn-danger';
    cityText.textContent = '⚠ MISAMIS ORIENTAL — ACTIVE · El Salvador not mentioned';
  } else if (es) {
    cityBanner.className = 'bn-danger';
    cityText.textContent = '⚠ EL SALVADOR CITY — ACTIVE · Misamis Oriental not mentioned';
  } else if (data.anyActive) {
    cityBanner.className = 'bn-warn';
    cityText.textContent = 'Advisory active · Outside your region';
  } else {
    cityBanner.className = 'bn-ok';
    cityText.textContent = '✓ No active advisories for your area';
  }
}

function renderAdvisory(key, info, noneLabel, emptyMsg) {
  const active  = !!(info && info.active);
  const cityHit = active && !!(info.cityIncluded);

  // Top 3-column card
  const col   = document.getElementById('col-'   + key);
  const stat  = document.getElementById('stat-'  + key);
  const advno = document.getElementById('advno-' + key);

  if (col && stat) {
    col.className = 'adv-col' + (active ? (cityHit ? ' col-danger' : ' col-warn') : '');
    if (!active) {
      stat.className = 'adv-status as-ok';
      stat.innerHTML = '<span class="as-icon">✅</span> ' + noneLabel;
    } else if (cityHit) {
      stat.className = 'adv-status as-danger';
      stat.innerHTML = '<span class="as-icon">⚠️</span> ACTIVE';
    } else {
      stat.className = 'adv-status as-warn';
      stat.innerHTML = '<span class="as-icon">⚡</span> Active';
    }
    if (advno) advno.textContent = active && info.number ? 'No. ' + info.number : '';
  }

  // Detail card below
  const dcard  = document.getElementById('dcard-'  + key);
  const dbadge = document.getElementById('dbadge-' + key);
  const dbody  = document.getElementById('dbody-'  + key);
  if (!dcard || !dbadge || !dbody) return;

  if (!active) {
    dcard.className  = 'detail-card';
    dbadge.className = 'dc-badge dcb-none';
    dbadge.textContent = 'NONE';
    dbody.innerHTML  = '<div class="dc-empty">' + emptyMsg + '</div>';
    return;
  }

  dcard.className  = 'detail-card' + (cityHit ? ' dc-active' : ' dc-warn');
  dbadge.className = cityHit ? 'dc-badge dcb-active' : 'dc-badge dcb-warn';
  dbadge.textContent = info.number ? 'NO. ' + info.number : 'ACTIVE';

  // Explicitly add the ALERT TYPE so users instantly know if it's a Watch or Advisory
  const typeRow = info.type     ? dcRow('ALERT TYPE', esc(info.type.toUpperCase()), true) : '';
  const numRow  = info.number   ? dcRow('ADV NO.',    'No. ' + info.number, false) : '';
  const timeRow = info.issuedAt ? dcRow('ISSUED',     esc(info.issuedAt), false)   : '';
  const sumRow  = info.summary  ? dcRow('SUMMARY',    esc(info.summary), false)    : '';
  
  const moHit = active && !!(info.misamisIncluded);
  const esHit = active && !!(info.elSalvadorIncluded);
  
  let cityTag = '';
  if (moHit && esHit) {
    cityTag = '<div class="dc-city-tag ct-yes">◉ Misamis Oriental &amp; El Salvador City — INCLUDED</div>';
  } else if (moHit) {
    cityTag = '<div class="dc-city-tag ct-yes">◉ Misamis Oriental — INCLUDED</div>' +
              '<div class="dc-city-tag ct-no">○ El Salvador City — not mentioned</div>';
  } else if (esHit) {
    cityTag = '<div class="dc-city-tag ct-no">○ Misamis Oriental — not mentioned</div>' +
              '<div class="dc-city-tag ct-yes">◉ El Salvador City — INCLUDED</div>';
  } else {
    cityTag = '<div class="dc-city-tag ct-no">○ Outside target region</div>';
  }

  dbody.innerHTML = '<div class="dc-rows">' + typeRow + numRow + timeRow + sumRow + '</div>' + cityTag;
}

function dcRow(key, val, big) {
  return '<div class="dc-row"><span class="dc-key">' + key + '</span>' +
         '<span class="dc-val' + (big ? ' v-big' : '') + '">' + val + '</span></div>';
}

function resetAll() {
  const cityBanner = document.getElementById('cityBanner');
  const cityText   = document.getElementById('cityBannerText');
  const issuedVal  = document.getElementById('issuedVal');
  if (cityBanner) cityBanner.className = 'bn-idle';
  if (cityText)   cityText.textContent = 'Misamis Oriental / El Salvador City';
  if (issuedVal)  issuedVal.textContent = '—';
  renderAdvisory('rain',    null, 'No Warning',  'No active rainfall warning.');
  renderAdvisory('thunder', null, 'No Warning',  'No active thunderstorm warning.');
  renderAdvisory('special', null, 'None',        'No special forecast at this time.');
}

function renderWatchBanner(watchInfo) {
  let el = document.getElementById('__watch-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = '__watch-banner';
    el.style.cssText = 'margin:0 0 10px 0;padding:8px 13px;border-radius:8px;background:rgba(230,126,34,.08);border:1px solid rgba(230,126,34,.3);font-size:11px;color:#e67e22;';
    const detailSection = document.querySelector('.detail-section');
    if (detailSection) detailSection.insertBefore(el, detailSection.firstChild);
  }
  const mo = watchInfo.misamisIncluded ? ' · Misamis Oriental included' : '';
  const es = watchInfo.elSalvadorIncluded ? ' · El Salvador included' : '';
  el.innerHTML = '<b>⚡ Thunderstorm Watch also active</b>' + mo + es +
    (watchInfo.issuedAt ? '<br><span style="font-size:10px;opacity:.7">Issued: ' + esc(watchInfo.issuedAt) + '</span>' : '') +
    (watchInfo.summary  ? '<br><span style="font-size:10px;opacity:.8">' + esc(watchInfo.summary.substring(0,120)) + '</span>' : '');
}

function removeWatchBanner() {
  const el = document.getElementById('__watch-banner');
  if (el) el.remove();
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
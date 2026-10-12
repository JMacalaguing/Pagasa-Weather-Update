// PAGASA Monitor - Content Script v3.3

(function () {
  'use strict';

  if (window.__pagasaMonitorActive) return;
  window.__pagasaMonitorActive = true;

  const PAGASA_URL  = 'https://www.pagasa.dost.gov.ph/regional-forecast/minprsd';
  const REFRESH_SEC = 30;

  const EQ_WIDGET_HEIGHT = 200; // px
  const WIDGET_BOTTOM    = EQ_WIDGET_HEIGHT + 1;

  let refreshCountdown = REFRESH_SEC;
  let countdownTimer   = null;
  let lastSentPostId   = null;

  // =========================================================================
  // WIDGET
  // =========================================================================

  function buildWidget() {
    if (document.getElementById('__pw')) return;

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      #__pw {
        position: fixed; bottom: ${WIDGET_BOTTOM}px; right: 16px; z-index: 2147483647; width: 297px;
        background: #0d1b2e; border: 1px solid #1a3050; border-radius: 10px;
        font-family: 'Inter', 'Segoe UI', sans-serif; color: #cde;
        box-shadow: 0 8px 32px rgba(0,0,0,.7); overflow: hidden; transition: border-color .4s, box-shadow .4s;
      }
      #__pw.st-danger { border-color: #c0392b; box-shadow: 0 0 24px rgba(192,57,43,.35), 0 8px 32px rgba(0,0,0,.7); }
      #__pw.st-warn { border-color: #d4890a; box-shadow: 0 0 18px rgba(212,137,10,.2), 0 8px 32px rgba(0,0,0,.7); }
      #__pw.st-ok { border-color: #1a7a4a; box-shadow: 0 0 14px rgba(26,122,74,.15), 0 8px 32px rgba(0,0,0,.7); }

      #__pw-hd { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #091526; border-bottom: 1px solid #1a3050; cursor: pointer; user-select: none; gap: 6px; }
      #__pw-hd:hover { background: #0c1d35; }
      #__pw-title { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 11px; color: #fff; letter-spacing: .3px; min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #__pw-dot { width: 7px; height: 7px; border-radius: 50%; background: #27ae60; flex-shrink: 0; box-shadow: 0 0 5px #27ae60; animation: __pw-pulse 2s infinite; }
      @keyframes __pw-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(1.3); } }
      #__pw-meta { display: flex; align-items: center; font-size: 9px; color: #4a6a8a; flex-shrink: 0; }
      #__pw-cd { color: #3a8fc7; white-space: nowrap; }

      #__pw-city { padding: 5px 10px; font-size: 10px; font-weight: 600; letter-spacing: .2px; border-bottom: 1px solid #1a3050; display: flex; align-items: center; gap: 6px; transition: all .3s; line-height: 1.3; }
      #__pw-city.c-danger { background: rgba(192,57,43,.15); color: #e74c3c; border-color: rgba(192,57,43,.4); animation: __pw-flash 1.6s infinite; }
      #__pw-city.c-ok { background: rgba(39,174,96,.08); color: #2ecc71; border-color: rgba(39,174,96,.2); }
      #__pw-city.c-neutral { background: transparent; color: #4a6a8a; }
      @keyframes __pw-flash { 0%,100%{opacity:1} 55%{opacity:.65} }
      .city-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
      #__pw-city.c-danger .city-dot { animation: __pw-pulse 1s infinite; }

      #__pw-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; border-bottom: 1px solid #1a3050; }
      .pw-card { padding: 8px 4px; border-right: 1px solid #1a3050; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: background .3s; min-width: 0; overflow: hidden; }
      .pw-card:last-child { border-right: none; }
      .pw-card.active-city  { background: rgba(192,57,43,.07); }
      .pw-card.active-other { background: rgba(212,137,10,.05); }

      .pw-card-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #4a6a8a; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pw-card-icon { font-size: 22px; line-height: 1; }
      .pw-card-status { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 9px; font-weight: 700; padding: 3px 5px; border-radius: 6px; text-align: center; width: 100%; line-height: 1.2; }
      .ps-none   { color: #2ecc71; }
      .ps-active { color: #e74c3c; background: rgba(192,57,43,.12); border: 1px solid rgba(192,57,43,.3); }
      .ps-warn   { color: #f39c12; background: rgba(212,137,10,.1);  border: 1px solid rgba(212,137,10,.3); }
      .pw-check  { font-size: 14px; display: block; }
      .pw-adv-no { font-size: 8px; font-weight: 700; color: #4a6a8a; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; }

      #__pw-ft { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #091526; gap: 8px; }
      #__pw-issued { font-size: 8px; color: #2a4a6a; letter-spacing: .2px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
      #__pw-open { font-size: 9px; font-weight: 600; color: #3a8fc7; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; letter-spacing: .2px; white-space: nowrap; flex-shrink: 0; }
      #__pw-open:hover { color: #5ab0e8; text-decoration: underline; }
    `;
    document.head.appendChild(style);

    const w = document.createElement('div');
    w.id = '__pw';
    w.innerHTML = `
      <div id="__pw-hd">
        <div id="__pw-title">
          <span id="__pw-dot"></span>
          🌩 PAGASA MINPRSD Monitor
        </div>
        <div id="__pw-meta">
          <span id="__pw-cd">sync: --:--</span>
        </div>
      </div>
      <div id="__pw-city" class="c-neutral">
        <span class="city-dot"></span>
        <span id="__pw-city-text">Misamis Oriental / El Salvador City</span>
      </div>
      <div id="__pw-cards">
        <div class="pw-card" id="__pwc-rain">
          <div class="pw-card-label">Rainfall</div>
          <div class="pw-card-icon">🌧</div>
          <div class="pw-card-status ps-none" id="__pws-rain">
            <span class="pw-check">✅</span>
            <span>No Warning</span>
          </div>
          <div class="pw-adv-no" id="__pwn-rain"></div>
        </div>
        <div class="pw-card" id="__pwc-thunder">
          <div class="pw-card-label">Thunderstorm</div>
          <div class="pw-card-icon">⛈</div>
          <div class="pw-card-status ps-none" id="__pws-thunder">
            <span class="pw-check">✅</span>
            <span>No Advisory</span>
          </div>
          <div class="pw-adv-no" id="__pwn-thunder"></div>
        </div>
        <div class="pw-card" id="__pwc-special">
          <div class="pw-card-label">Special</div>
          <div class="pw-card-icon">📋</div>
          <div class="pw-card-status ps-none" id="__pws-special">
            <span class="pw-check">✅</span>
            <span>None</span>
          </div>
          <div class="pw-adv-no" id="__pwn-special"></div>
        </div>
      </div>
      <div id="__pw-ft">
        <span id="__pw-issued">Issued: —</span>
        <button id="__pw-open">Open PAGASA Site →</button>
      </div>
    `;
    document.body.appendChild(w);

    document.getElementById('__pw-hd').addEventListener('click', openPagasa);
    document.getElementById('__pw-open').addEventListener('click', (e) => {
      e.stopPropagation();
      openPagasa();
    });
  }

  function openPagasa() { window.open(PAGASA_URL, '_blank'); }

  function updateWidget() {
    chrome.storage.local.get(['pagasaStatus'], ({ pagasaStatus }) => {
      if (pagasaStatus) renderWidget(pagasaStatus);
    });
  }

  function renderWidget(data) {
    const widget   = document.getElementById('__pw');
    const dot      = document.getElementById('__pw-dot');
    const cityEl   = document.getElementById('__pw-city');
    const cityText = document.getElementById('__pw-city-text');
    const issued   = document.getElementById('__pw-issued');
    if (!widget) return;

    const mo = data.misamisOrientalIncluded;
    const es = data.elSalvadorIncluded;
    if (mo && es) {
      widget.className = 'st-danger';
      dot.style.background = '#e74c3c';
      dot.style.boxShadow  = '0 0 8px #e74c3c';
      cityEl.className = 'c-danger';
      cityText.textContent = '⚠ MISAMIS ORIENTAL & EL SALVADOR — BOTH INCLUDED';
    } else if (mo) {
      widget.className = 'st-danger';
      dot.style.background = '#e74c3c';
      dot.style.boxShadow  = '0 0 8px #e74c3c';
      cityEl.className = 'c-danger';
      cityText.textContent = '⚠ MISAMIS ORIENTAL — INCLUDED · El Salvador not mentioned';
    } else if (es) {
      widget.className = 'st-danger';
      dot.style.background = '#e74c3c';
      dot.style.boxShadow  = '0 0 8px #e74c3c';
      cityEl.className = 'c-danger';
      cityText.textContent = '⚠ EL SALVADOR CITY — INCLUDED · Misamis Oriental not mentioned';
    } else if (data.anyActive) {
      widget.className = 'st-warn';
      dot.style.background = '#f39c12';
      dot.style.boxShadow  = '0 0 6px #f39c12';
      cityEl.className = 'c-neutral';
      cityText.textContent = 'Advisory active · Your area NOT included';
    } else {
      widget.className = 'st-ok';
      dot.style.background = '#27ae60';
      dot.style.boxShadow  = '0 0 6px #27ae60';
      cityEl.className = 'c-ok';
      cityText.textContent = '✓ No active advisories for your area';
    }

    if (issued) issued.textContent = `Issued: ${data.issuedAt || data.fetchedAt || '—'}`;

    renderCardWidget('rain',    data.rainfall);
    const thunderDisplay = data.thunderstorm && data.thunderstorm.active
      ? data.thunderstorm
      : (data.thunderstormWatch && data.thunderstormWatch.active ? data.thunderstormWatch : data.thunderstorm);
    renderCardWidget('thunder', thunderDisplay);
    renderCardWidget('special', data.special);
  }

  function renderCardWidget(key, info) {
    const card   = document.getElementById(`__pwc-${key}`);
    const status = document.getElementById(`__pws-${key}`);
    const advNo  = document.getElementById(`__pwn-${key}`);
    if (!card || !status) return;

    if (!info || !info.active) {
      card.className  = 'pw-card';
      status.className = 'pw-card-status ps-none';
      status.innerHTML = '<span class="pw-check">✅</span><span>' +
        (key === 'rain' ? 'No Warning' : key === 'thunder' ? 'No Advisory' : 'None') + '</span>';
      advNo.textContent = '';
      return;
    }

    if (info.cityIncluded) {
      card.className   = 'pw-card active-city';
      status.className = 'pw-card-status ps-active';
      status.innerHTML = '<span class="pw-check">⚠️</span><span>Active</span>';
    } else {
      card.className   = 'pw-card active-other';
      status.className = 'pw-card-status ps-warn';
      status.innerHTML = '<span class="pw-check">⚡</span><span>Active</span>';
    }
    if (info.type === 'Thunderstorm Watch') {
      advNo.textContent = 'Thunderstorm Watch';
    } else {
      advNo.textContent = info.number ? `Advisory No. ${info.number}` : '';
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pagasaStatus) renderWidget(changes.pagasaStatus.newValue);
  });

  // =========================================================================
  // PAGASA WEBSITE SCRAPER
  // =========================================================================

  const MISAMIS_AREAS   = ['misamis oriental','misamisoriental','cagayan de oro','cagayandeoro','laguindingan','cdo'];
  const ELSALVADOR_AREAS = ['el salvador','elsalvador','cityofelsalvador'];

  function misamisMatches(text) {
    const lower = text.toLowerCase().replace(/\s+/g,' ');
    return MISAMIS_AREAS.some(a => lower.includes(a));
  }
  function elSalvadorMatches(text) {
    const compact = text.toLowerCase().replace(/\s+/g,'');
    return ELSALVADOR_AREAS.some(a => compact.includes(a.replace(/\s+/g,'')));
  }

  function parseSection(text, type) {
    if (!text) return { active: false, type };

    const lower = text.toLowerCase();
    const noActive =
      lower.includes('there is no heavy rainfall') ||
      lower.includes('no heavy rainfall warning') ||
      lower.includes('there is no thunderstorm advisory') ||
      lower.includes('no thunderstorm advisory') ||
      lower.includes('there is no thunderstorm watch') ||
      lower.includes('there is no special forecast') ||
      lower.includes('no special forecast') ||
      lower.includes('no active') ||
      lower.includes('no warning issued') ||
      lower.includes('none at this time') ||
      (lower.includes('terminated') && !lower.match(/advisory no\.?\s*\d+/i));

    if (noActive) return { active: false, type };

    const numMatch = text.match(/No\.?\s*(\d+)/i);
    const number   = numMatch ? numMatch[1] : null;

    const timeMatch = text.match(/[Ii]ssued\s+[Aa]t[:\s]+([\d]{1,2}:[\d]{2}\s*(?:AM|PM)[^\n]{0,50})/i);
    const issuedAt  = timeMatch ? timeMatch[1].trim() : null;

    const misamisIncluded    = misamisMatches(text);
    const elSalvadorIncluded = elSalvadorMatches(text);
    const cityIncluded       = misamisIncluded || elSalvadorIncluded;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 15);
    const summary = lines.find(l =>
      !l.match(/^(thunderstorm|rainfall|special)/i) &&
      !l.match(/^no\.?\s*\d+/i) &&
      !l.match(/^issued at/i) &&
      !l.match(/^#minprsd/i) &&
      l.length > 20
    ) || lines[1] || lines[0] || '';

    const active = !!(
      number ||
      lower.match(/advisory no\.?\s*\d+/i) ||
      lower.includes('are expected') ||
      lower.includes('are being experienced') ||
      lower.includes('take precautionary') ||
      lower.includes('is more likely') ||
      lower.includes('rainshowers') ||
      lower.includes('lightning') ||
      (type === 'Special Forecast' && text.length > 60)
    );

    if (!active) return { active: false, type };

    return {
      active: true, type, number, issuedAt,
      cityIncluded, misamisIncluded, elSalvadorIncluded,
      summary: summary.substring(0, 200),
    };
  }

  function parseThunderstormSection(text) {
    const advMatch = text.match(/(Thunderstorm Advisory No\.?\s*\d+[\s\S]*)/i);
    const watchRaw = advMatch ? text.substring(0, text.indexOf(advMatch[0])) : text;
    const advRaw   = advMatch ? advMatch[0] : '';

    const lowerWatch = watchRaw.toLowerCase();
    const hasWatch   = lowerWatch.includes('thunderstorm watch') ||
                       lowerWatch.includes('is more likely') ||
                       lowerWatch.includes('likely to develop');

    return {
      thunderstorm:      advRaw  ? parseSection(advRaw,   'Thunderstorm Advisory') : { active: false, type: 'Thunderstorm Advisory' },
      thunderstormWatch: hasWatch ? parseSection(watchRaw, 'Thunderstorm Watch')    : { active: false, type: 'Thunderstorm Watch' },
    };
  }

  // ── Extract clean text from a specific DOM element ───────────────────────
  function getCleanTextFromElement(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    // Strip invisible elements
    clone.querySelectorAll('script, style, noscript').forEach(n => n.remove());
    // Force line breaks so regex parsing doesn't break
    clone.querySelectorAll('div, p, br, h1, h2, h3, h4, h5, h6, li, tr').forEach(n => {
      n.appendChild(document.createTextNode('\n'));
    });
    return clone.textContent.replace(/\n\s*\n/g, '\n').trim();
  }

  // ── Main scrape function ───────────────────────────────────────────────────
  function scrapePage() {
    if (!window.location.hostname.includes('pagasa.dost.gov.ph')) return null;

    // Grab the whole body ONLY for finding the global "Issued At" timestamp
    const fullBodyText = getCleanTextFromElement(document.body);
    if (fullBodyText.length < 200) return null; // page not loaded yet

    // Target the actual HTML tab panels used by PAGASA
    const rainEl    = document.getElementById('rainfalls') || document.querySelector('[id*="rainfall"]');
    const thunderEl = document.getElementById('thunderstorms') || document.querySelector('[id*="thunderstorm"]');
    const specialEl = document.getElementById('special-forecasts') || document.querySelector('[id*="special"]');

    // Extract text directly from the content tabs (bypassing the top menu entirely)
    const rainText    = getCleanTextFromElement(rainEl);
    const thunderText = getCleanTextFromElement(thunderEl);
    const specialText = getCleanTextFromElement(specialEl);

    const rainfall        = parseSection(rainText, 'Rainfall Warning');
    const { thunderstorm, thunderstormWatch } = parseThunderstormSection(thunderText);
    const special         = parseSection(specialText, 'Special Forecast');

    // Extract global issuedAt from page if individual blocks don't have it
    const globalTimeMatch = fullBodyText.match(/[Ii]ssued\s+[Aa]t[:\s]+([\d]{1,2}:[\d]{2}\s*(?:AM|PM)[^\n]{0,50})/i);
    const issuedAt = (rainfall.issuedAt || thunderstorm.issuedAt || thunderstormWatch.issuedAt || special.issuedAt ||
                     (globalTimeMatch ? globalTimeMatch[1].trim() : null));

    const anyActive = !!(
      (rainfall.active) ||
      (thunderstorm.active) ||
      (thunderstormWatch.active) ||
      (special.active)
    );

    const misamisOrientalIncluded = !!(
      (rainfall.active      && rainfall.misamisIncluded) ||
      (thunderstorm.active  && thunderstorm.misamisIncluded) ||
      (thunderstormWatch.active && thunderstormWatch.misamisIncluded) ||
      (special.active       && special.misamisIncluded)
    );
    const elSalvadorIncluded = !!(
      (rainfall.active      && rainfall.elSalvadorIncluded) ||
      (thunderstorm.active  && thunderstorm.elSalvadorIncluded) ||
      (thunderstormWatch.active && thunderstormWatch.elSalvadorIncluded) ||
      (special.active       && special.elSalvadorIncluded)
    );
    const cityIncluded = misamisOrientalIncluded || elSalvadorIncluded;

    return {
      rainfall, thunderstorm, thunderstormWatch, special,
      anyActive, cityIncluded, misamisOrientalIncluded, elSalvadorIncluded,
      issuedAt,
      fetchedAt: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
    };
  }

  function makePostId(data) {
    const str = [
      data.rainfall          ? `r${data.rainfall.number          || (data.rainfall.active          ? '1':'0')}` : 'r0',
      data.thunderstorm      ? `t${data.thunderstorm.number       || (data.thunderstorm.active       ? '1':'0')}` : 't0',
      data.thunderstormWatch ? `w${data.thunderstormWatch.number  || (data.thunderstormWatch.active  ? '1':'0')}` : 'w0',
      data.special           ? `s${data.special.number            || (data.special.active            ? '1':'0')}` : 's0',
      data.issuedAt ? data.issuedAt.replace(/[^a-zA-Z0-9]/g,'') : 'x',
    ].join('-');
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    return 'pid_' + Math.abs(hash).toString(36);
  }

  let scraperStarted = false;
  let lastScrapedId  = null;

  function initScraper() {
    if (scraperStarted) return;
    scraperStarted = true;
    tryScrapePage();
    setInterval(tryScrapePage, 15000);
    new MutationObserver(() => tryScrapePage())
      .observe(document.body, { childList: true, subtree: true });
  }

  function tryScrapePage() {
    const result = scrapePage();
    if (!result) return;

    const postId = makePostId(result);
    if (postId === lastScrapedId) return;
    lastScrapedId = postId;

    chrome.storage.local.get(['pagasaStatus', 'acknowledgedPostId', 'lastNotifiedPostId'], (stored) => {
      const storedPostId      = stored.pagasaStatus ? stored.pagasaStatus.postId : null;
      const acknowledgedId    = stored.acknowledgedPostId || null;
      const lastNotifiedId    = stored.lastNotifiedPostId || null;

      chrome.storage.local.set({ pagasaStatus: { ...result, postId } });
      renderWidget({ ...result, postId });

      // Don't send if already acknowledged or already notified
      if (postId === acknowledgedId) { lastSentPostId = postId; return; }
      if (postId === lastNotifiedId) { lastSentPostId = postId; return; }
      if (postId === storedPostId && postId === lastSentPostId) return;

      lastSentPostId = postId;
      chrome.runtime.sendMessage({ action: 'PAGASA_STATUS_UPDATE', data: { ...result, postId } });
    });
  }

  function initAutoRefresh() {
    refreshCountdown = REFRESH_SEC;
    countdownTimer = setInterval(() => {
      refreshCountdown--;
      const m  = Math.floor(refreshCountdown / 60);
      const s  = refreshCountdown % 60;
      const el = document.getElementById('__pw-cd');
      if (el) el.textContent = `sync: ${m}:${String(s).padStart(2, '0')}`;
      if (refreshCountdown <= 0) {
        clearInterval(countdownTimer);
        window.location.reload();
      }
    }, 1000);
  }

  function boot() {
    // Floating widget disabled — using the side panel only now.
    // (Widget-building code below is left in place but unused/never called.)

    if (window.location.hostname.includes('pagasa.dost.gov.ph')) {
      initScraper();
      initAutoRefresh();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
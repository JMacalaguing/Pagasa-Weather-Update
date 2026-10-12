// PAGASA Alert Monitor - Background Service Worker v3.1

const PAGASA_URL = 'https://www.pagasa.dost.gov.ph/regional-forecast/minprsd';

// ─── ntfy.sh Phone Alerts ─────────────────────────────────────────────────────
// Install the FREE "ntfy" app on your phone → subscribe to the topic below
// Android: https://play.google.com/store/apps/details?id=io.heckel.ntfy
// iOS:     https://apps.apple.com/app/ntfy/id1625396347
const NTFY_TOPIC = 'pagasa-elsalvador-alert'; // ← your topic (keep it private)
const NTFY_URL   = `https://ntfy.sh/`; // URL updated for JSON posting

// ─── Side Panel ───────────────────────────────────────────────────────────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error('[Side Panel]', e));

// ─── Alarms — fetch every 5 minutes even if tab is closed ────────────────────
chrome.alarms.create('pagasaCheck', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pagasaCheck') {
    openOrRefreshPagasaTab();
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // New scraped status from content.js
  if (msg.action === 'PAGASA_STATUS_UPDATE') {
    handleStatusUpdate(msg.data);
    sendResponse({ ok: true });
    return true;
  }

  // Triggered by the "Fetch Now" button in the popup
  if (msg.action === 'MANUAL_FETCH') {
    openOrRefreshPagasaTab();
    sendResponse({ ok: true });
    return true;
  }

  // Clear all
  if (msg.action === 'CLEAR_ALERTS') {
    chrome.storage.local.remove(['pagasaStatus', 'acknowledgedPostId', 'lastNotifiedPostId']);
    chrome.tts.stop();
    sendResponse({ ok: true });
    return true;
  }

  // Open PAGASA tab
  if (msg.action === 'OPEN_PAGASA_TAB') {
    openOrFocusPagasaTab();
    sendResponse({ ok: true });
    return true;
  }
});

// ─── Open or focus PAGASA tab ─────────────────────────────────────────────────
function openOrFocusPagasaTab() {
  chrome.tabs.query({ url: `${PAGASA_URL}*` }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true }).catch((e) => {
        console.warn('[PAGASA BG] tabs.update failed:', e.message);
      });
      if (tabs[0].windowId !== undefined && tabs[0].windowId !== chrome.windows.WINDOW_ID_NONE) {
        chrome.windows.update(tabs[0].windowId, { focused: true }).catch((e) => {
          console.warn('[PAGASA BG] windows.update failed (probably no open window):', e.message);
        });
      }
    } else {
      chrome.tabs.create({ url: PAGASA_URL, active: false }).catch((e) => {
        console.warn('[PAGASA BG] tabs.create failed:', e.message);
      });
    }
  });
}

// Reload if already open, open if not
function openOrRefreshPagasaTab() {
  chrome.tabs.query({ url: `${PAGASA_URL}*` }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.reload(tabs[0].id).catch((e) => {
        console.warn('[PAGASA BG] tabs.reload failed:', e.message);
      });
    } else {
      chrome.tabs.create({ url: PAGASA_URL, active: false }).catch((e) => {
        console.warn('[PAGASA BG] tabs.create failed:', e.message);
      });
    }
  });
}

// ─── Handle Status Update ─────────────────────────────────────────────────────
function handleStatusUpdate(data) {
  // Save latest status
  chrome.storage.local.set({ pagasaStatus: data });

  // ── Skip if already acknowledged OR already notified for this exact postId ──
  chrome.storage.local.get(['acknowledgedPostId', 'lastNotifiedPostId'], ({ acknowledgedPostId, lastNotifiedPostId }) => {
    if (data.postId && data.postId === acknowledgedPostId) {
      console.log('[PAGASA BG] Skipping — already acknowledged:', data.postId);
      return;
    }
    if (data.postId && data.postId === lastNotifiedPostId) {
      console.log('[PAGASA BG] Skipping — already notified for this alert:', data.postId);
      return;
    }
    // Mark as notified BEFORE firing so rapid calls don't slip through
    if (data.postId) {
      chrome.storage.local.set({ lastNotifiedPostId: data.postId });
    }
    _fireNotificationAndAlert(data);
  });
}

function _fireNotificationAndAlert(data) {

  // Build notification content
  const lines = [];
  if (data.rainfall          && data.rainfall.active)          lines.push(`🌧 Rainfall Warning No. ${data.rainfall.number || '?'}`);
  if (data.thunderstorm      && data.thunderstorm.active)      lines.push(`⚡ Thunderstorm Advisory No. ${data.thunderstorm.number || '?'}`);
  if (data.thunderstormWatch && data.thunderstormWatch.active) lines.push(`🌩 Thunderstorm Watch Active`);
  if (data.special           && data.special.active)           lines.push(`📋 Special Forecast Active`);

  const affectedAreas = [
    data.misamisOrientalIncluded ? 'Misamis Oriental' : null,
    data.elSalvadorIncluded      ? 'El Salvador City' : null,
  ].filter(Boolean);

  const title = affectedAreas.length > 0
    ? `⚠️ PAGASA: Active — ${affectedAreas.join(' & ')}!`
    : data.anyActive
      ? '📡 PAGASA: Advisory Active (Outside Region)'
      : '✅ PAGASA: No Active Advisories';

  const message = lines.length > 0
    ? lines.join(' | ')
    : 'No active advisories for Mindanao at this time.';

  const contextMessage = data.issuedAt
    ? `Issued: ${data.issuedAt}`
    : data.fetchedAt || '';

  // Show notification
  const notifId = 'pagasa_' + Date.now();
  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    contextMessage,
    buttons: [{ title: '✅ OK — Got it' }],
    requireInteraction: data.cityIncluded, // only stay persistent if city is affected
    priority: data.cityIncluded ? 2 : 1,
  });

  // Voice alert — speak when city is included OR any advisory is active
  const voiceParts = [];
  if (data.thunderstorm && data.thunderstorm.active) {
    const num = data.thunderstorm.number ? ` Number ${data.thunderstorm.number}` : '';
    voiceParts.push(`Thunderstorm Advisory${num}.`);
  }
  if (data.thunderstormWatch && data.thunderstormWatch.active) {
    voiceParts.push('Thunderstorm Watch is also active.');
  }
  if (data.rainfall && data.rainfall.active) {
    const num = data.rainfall.number ? ` Number ${data.rainfall.number}` : '';
    voiceParts.push(`Rainfall Warning${num}.`);
  }
  if (data.special && data.special.active) {
    voiceParts.push('Special Forecast is active.');
  }

  if (voiceParts.length > 0) {
    let cityPart = '';
    if (data.misamisOrientalIncluded && data.elSalvadorIncluded) {
      cityPart = ' Misamis Oriental and El Salvador City are both included in the affected areas. Please take necessary precautions.';
    } else if (data.misamisOrientalIncluded) {
      cityPart = ' Misamis Oriental is included in the affected areas. El Salvador City is not explicitly mentioned.';
    } else if (data.elSalvadorIncluded) {
      cityPart = ' El Salvador City is included in the affected areas. Please take necessary precautions.';
    } else {
      cityPart = ' Your area is currently not included.';
    }
    speakAlert(`PAGASA Alert. ${voiceParts.join(' ')}${cityPart}`);

    // ── ntfy phone notification ──────────────────────────────────────────────
    const phoneTitle = affectedAreas.length > 0
      ? `⚠️ PAGASA — ${affectedAreas.join(' & ')} INCLUDED`
      : '📡 PAGASA — Advisory Active (Mindanao)';
    const phoneLines = [
      ...lines,
      cityPart.trim(),
      data.issuedAt ? `Issued: ${data.issuedAt}` : '',
    ].filter(Boolean);
    sendPhoneAlert(phoneTitle, phoneLines.join('\n'), data.cityIncluded ? 'urgent' : 'default');
  }
} // end _fireNotificationAndAlert

// ─── OK button ───────────────────────────────────────────────────────────────
chrome.notifications.onButtonClicked.addListener((notifId, btnIndex) => {
  if (btnIndex === 0) {
    acknowledgeCurrentStatus();
    chrome.tts.stop();
    chrome.notifications.clear(notifId);
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  acknowledgeCurrentStatus();
  openOrFocusPagasaTab();
  chrome.tts.stop();
  chrome.notifications.clear(notifId);
});

function acknowledgeCurrentStatus() {
  chrome.storage.local.get(['pagasaStatus'], ({ pagasaStatus }) => {
    if (pagasaStatus && pagasaStatus.postId) {
      chrome.storage.local.set({ acknowledgedPostId: pagasaStatus.postId });
      console.log('[PAGASA BG] Acknowledged:', pagasaStatus.postId);
    }
  });
}

// ─── Service Worker Keep-Alive ────────────────────────────────────────────────
let _keepAliveTimer = null;

function startKeepAlive() {
  stopKeepAlive();
  _keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}

function stopKeepAlive() {
  if (_keepAliveTimer) { clearInterval(_keepAliveTimer); _keepAliveTimer = null; }
}

// ─── Phone Alert (ntfy.sh) ───────────────────────────────────────────────────
function sendPhoneAlert(title, body, priority = 'default') {
  let prioNum = 3; // default
  if (priority === 'urgent') prioNum = 5;
  else if (priority === 'high') prioNum = 4;

  fetch(NTFY_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Using a JSON body safely allows emojis (unlike HTTP headers)
    body: JSON.stringify({
      topic: NTFY_TOPIC,
      title: title,
      message: body,
      priority: prioNum,
      tags: ['warning', 'philippines', 'rain']
    })
  })
  .then(r => console.log(`[PAGASA ntfy] ${r.status} → ${NTFY_TOPIC}`))
  .catch(e => console.warn('[PAGASA ntfy] Failed:', e.message));
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function speakAlert(text) {
  chrome.tts.stop();
  startKeepAlive();

  setTimeout(() => {
    chrome.tts.speak(text, {
      lang: 'en-US',
      rate: 0.85,
      pitch: 1.0,
      volume: 1.0,
      onEvent: (event) => {
        if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled') {
          stopKeepAlive();
        }
        if (event.type === 'error') {
          console.error('[PAGASA TTS] Error:', event.errorMessage);
          stopKeepAlive();
          retrySpeak(text);
        } else {
          console.log('[PAGASA TTS] Event:', event.type);
        }
      }
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[PAGASA TTS] speak() failed:', chrome.runtime.lastError.message);
        stopKeepAlive();
        retrySpeak(text);
      }
    });
  }, 300);
}

let _retried = false;
function retrySpeak(text) {
  if (_retried) { _retried = false; return; } 
  _retried = true;
  console.log('[PAGASA TTS] Retrying without lang...');
  setTimeout(() => {
    chrome.tts.speak(text, {
      rate: 0.85,
      pitch: 1.0,
      volume: 1.0,
    });
    _retried = false;
  }, 500);
}
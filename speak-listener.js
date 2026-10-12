// speak-listener.js — voice helper
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'SPEAK' && msg.text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg.text);
    u.lang = 'en-PH'; u.rate = 0.9; u.pitch = 1.0; u.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const best = voices.find(v => v.lang.startsWith('en') &&
      (v.name.includes('Google') || v.name.includes('Microsoft')))
      || voices.find(v => v.lang.startsWith('en'));
    if (best) u.voice = best;
    window.speechSynthesis.speak(u);
  }
  if (msg.action === 'STOP_SPEAK') {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
});
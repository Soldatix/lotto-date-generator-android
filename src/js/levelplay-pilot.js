/**
 * Date Lotto Generator / Unity LevelPlay: ANDROID TAURI MOCK ONLY.
 *
 * This deliberately never imports an ad SDK or requests advertising.
 * Open only inside the Android Tauri WebView with ?levelPlayPreview=1.
 * Consent controls are demonstrations, not a legal CMP or saved preference.
 * The real LevelPlay banner must eventually be a native Android View
 * integrated with the Tauri Activity, not HTML/WebView ad code.
 */
export function initializeLevelPlayPreview({ document: doc = document, window: win = window } = {}) {
  const region = doc.getElementById('levelPlayPilot');
  if (!region) return { active: false };
  const params = new URLSearchParams(win.location.search);
  const isTauri = Boolean(win.__TAURI_INTERNALS__) ||
    win.location.hostname === 'tauri.localhost';
  const isAndroid = /Android/i.test(win.navigator.userAgent);
  if (params.get('levelPlayPreview') !== '1' || !isTauri || !isAndroid) {
    return { active: false };
  }

  const messages = {
    en: {
      heading: 'Ad banner preview — test only',
      detail: 'Future optional advertising may use an Android ad network. This is only a visual test; it does not connect to Unity LevelPlay or collect consent.',
      allow: 'Preview banner', reject: 'Keep ads hidden', change: 'Change demo choice',
      ad: 'Advertisement', mock: '320 × 50 • test placement • no ad loaded',
      denied: 'Demo choice: no banner. The generator remains available.',
      enabled: 'Demo banner placement only — no tracking or ad requests.',
      narrow: 'The test banner is hidden on screens narrower than 320 px.'
    },
    hr: {
      heading: 'Pregled bannera — samo test',
      detail: 'Budući neobavezni oglasi mogu koristiti Android oglasnu mrežu. Ovo je samo vizualni test; ne povezuje se s Unity LevelPlayom i ne prikuplja stvarnu privolu.',
      allow: 'Prikaži probni banner', reject: 'Bez bannera', change: 'Promijeni probni izbor',
      ad: 'Oglas', mock: '320 × 50 • probno mjesto • bez stvarnog oglasa',
      denied: 'Probni izbor: bez bannera. Generator ostaje dostupan.',
      enabled: 'Samo probni prikaz mjesta — nema praćenja ni oglasnih zahtjeva.',
      narrow: 'Probni banner skriven je na ekranima užim od 320 px.'
    },
    de: {
      heading: 'Bannervorschau — nur Test',
      detail: 'Optionale zukünftige Anzeigen können ein Android-Werbenetzwerk verwenden. Dies ist nur eine visuelle Vorschau ohne Unity-LevelPlay-Verbindung und keine echte Einwilligung.',
      allow: 'Testbanner zeigen', reject: 'Keine Banner', change: 'Testauswahl ändern',
      ad: 'Anzeige', mock: '320 × 50 • Testplatz • keine Anzeige geladen',
      denied: 'Testauswahl: kein Banner. Der Generator bleibt verfügbar.',
      enabled: 'Nur Vorschau — keine Tracking- oder Werbeanfragen.',
      narrow: 'Auf Bildschirmen unter 320 px wird kein Banner gezeigt.'
    },
    it: {
      heading: 'Anteprima banner — solo test',
      detail: 'La futura pubblicità facoltativa potrebbe usare una rete Android. Questa è solo un’anteprima visiva, senza connessione a Unity LevelPlay né consenso reale.',
      allow: 'Mostra banner di prova', reject: 'Nessun banner', change: 'Cambia scelta di prova',
      ad: 'Pubblicità', mock: '320 × 50 • spazio di prova • nessun annuncio',
      denied: 'Scelta di prova: nessun banner. Il generatore resta disponibile.',
      enabled: 'Solo anteprima: nessun tracciamento né richiesta pubblicitaria.',
      narrow: 'Banner nascosto su schermi inferiori a 320 px.'
    },
    es: {
      heading: 'Vista previa del banner — solo prueba',
      detail: 'La publicidad opcional futura puede usar una red de Android. Es solo una vista previa visual, sin conexión con Unity LevelPlay ni consentimiento real.',
      allow: 'Mostrar banner de prueba', reject: 'Sin banner', change: 'Cambiar elección de prueba',
      ad: 'Publicidad', mock: '320 × 50 • espacio de prueba • sin anuncios',
      denied: 'Elección de prueba: sin banner. El generador sigue disponible.',
      enabled: 'Solo vista previa: sin seguimiento ni solicitudes publicitarias.',
      narrow: 'El banner se oculta en pantallas de menos de 320 px.'
    }
  };
  const languageSelect = doc.getElementById('language');
  let choice = null; // Never persisted. A separate reviewed CMP is required later.
  function t() {
    return messages[languageSelect?.value] || messages.en;
  }
  function node(tag, cls, value) {
    const element = doc.createElement(tag);
    if (cls) element.className = cls;
    if (value !== undefined) element.textContent = value;
    return element;
  }
  function button(label, action) {
    const result = node('button', 'levelplay-pilot-button', label);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
  }
  function render() {
    const l = t();
    const contents = [
      node('h2', 'levelplay-pilot-heading', l.heading),
      node('p', 'levelplay-pilot-detail', l.detail)
    ];
    const actions = node('div', 'levelplay-pilot-actions');
    if (choice === null) {
      actions.append(
        button(l.reject, () => { choice = 'reject'; render(); }),
        button(l.allow, () => { choice = 'preview'; render(); })
      );
    } else {
      contents.push(node('p', 'levelplay-pilot-status', choice === 'preview' ? l.enabled : l.denied));
      if (choice === 'preview') {
        if (win.innerWidth >= 320) {
          const label = node('p', 'levelplay-pilot-label', l.ad);
          const placeholder = node('div', 'levelplay-pilot-placeholder', l.mock);
          placeholder.setAttribute('role', 'img');
          placeholder.setAttribute('aria-label', l.mock);
          contents.push(label, placeholder);
        } else {
          contents.push(node('p', 'levelplay-pilot-status', l.narrow));
        }
      }
      actions.append(button(l.change, () => { choice = null; render(); }));
    }
    contents.push(actions);
    region.replaceChildren(...contents);
    region.hidden = false;
  }
  render();
  languageSelect?.addEventListener('change', render);
  win.addEventListener('resize', render);
  return { active: true };
}
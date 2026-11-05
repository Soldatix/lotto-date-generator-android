import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({headless:true});
const androidUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const blocked = [];
try {
  async function newPage({android=false, tauri=false, width=375} = {}) {
    const context = await browser.newContext({
      viewport: {width, height:812},
      userAgent: android ? androidUA : undefined,
      serviceWorkers:'block'
    });
    await context.route('**/*', route => {
      const dest = new URL(route.request().url());
      if(dest.origin===new URL(base).origin) return route.continue();
      blocked.push(dest.href);
      return route.abort();
    });
    if(tauri) await context.addInitScript(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', {value:{}, configurable:true});
    });
    const page = await context.newPage();
    return {context,page};
  }

  const standard = await newPage();
  await standard.page.goto(base);
  assert.equal(await standard.page.locator('#levelPlayPilot').isHidden(),true);
  await standard.page.goto(base+'?levelPlayPreview=1');
  assert.equal(await standard.page.locator('#levelPlayPilot').isHidden(),true);
  await standard.context.close();
  console.log('PASS: normal web and desktop preview never show banner');

  const androidWeb = await newPage({android:true});
  await androidWeb.page.goto(base+'?levelPlayPreview=1');
  assert.equal(await androidWeb.page.locator('#levelPlayPilot').isHidden(),true);
  await androidWeb.context.close();
  console.log('PASS: Android browser/PWA is not treated as Android Tauri');

  const desktopTauri = await newPage({tauri:true});
  await desktopTauri.page.goto(base+'?levelPlayPreview=1');
  assert.equal(await desktopTauri.page.locator('#levelPlayPilot').isHidden(),true);
  await desktopTauri.context.close();
  console.log('PASS: desktop Tauri does not display Android ad mock');

  const androidTauri = await newPage({android:true,tauri:true});
  const page=androidTauri.page;
  await page.goto(base+'?levelPlayPreview=1');
  assert.equal(await page.locator('#levelPlayPilot').isVisible(),true);
  assert.equal(await page.locator('.levelplay-pilot-button').count(),2);
  assert.equal(await page.locator('.levelplay-pilot-placeholder').count(),0);
  await page.locator('.levelplay-pilot-button').first().click();
  assert.equal(await page.locator('.levelplay-pilot-placeholder').count(),0);
  await page.locator('.levelplay-pilot-button').first().click();
  await page.locator('.levelplay-pilot-button').nth(1).click();
  assert.equal(await page.locator('.levelplay-pilot-placeholder').count(),1);
  const rect=await page.locator('.levelplay-pilot-placeholder').boundingBox();
  assert.ok(rect && rect.width<=321 && rect.height>=49, 'Expected 320x50 banner mock');
  assert.ok(rect.x>=-0.5 && rect.x+rect.width<=375.5, 'Mock overflowed viewport');
  console.log('PASS: Android Tauri test consent/reject and 320x50 placement');

  for(const [lang,fragment] of [['hr','Pregled bannera'],['de','Bannervorschau'],['it','Anteprima banner'],['es','Vista previa del banner'],['en','Ad banner preview']]){
    await page.locator('#language').selectOption(lang);
    assert.ok((await page.locator('.levelplay-pilot-heading').textContent()).includes(fragment),lang);
  }
  console.log('PASS: EN/HR/DE/IT/ES localized placeholder');

  await page.setViewportSize({width:300,height:700});
  // Resize and React-style re-render are asynchronous in Chromium.
  await page.waitForFunction(() => window.innerWidth === 300
    && document.querySelector('.levelplay-pilot-placeholder') === null);
  assert.equal(await page.locator('.levelplay-pilot-placeholder').count(),0);
  await page.reload();
  assert.equal(await page.locator('.levelplay-pilot-placeholder').count(),0);
  assert.equal(await page.locator('.levelplay-pilot-button').count(),2);
  assert.equal(blocked.filter(x=>/unity|ironsource|levelplay|admob|applovin|adsterra/i.test(x)).length,0);
  // Tablet in-panel layout smoke: source stays hidden until the native debug
  // intent asks Android WebView to reveal this *visual mock*.
  await page.setViewportSize({width:1100,height:812});
  await page.reload();
  assert.equal(await page.locator('#nativeTabletBannerProbe').isHidden(), true);
  await page.evaluate(() => { document.getElementById('nativeTabletBannerProbe').hidden = false; });
  await page.locator('#dateInput').fill('05/11/2026');
  await page.locator('#generateBtn').click();
  await page.locator('#saveBtn').click();
  const bounds=await page.evaluate(() => {
    const b=sel=>document.querySelector(sel).getBoundingClientRect().toJSON();
    return {
      card:b('.resultBox'),
      result:b('#resultArea'),
      history:b('#historyWrap'),
      slot:b('#nativeTabletBannerProbe'),
      first:b('.grid > .card:first-child')
    };
  });
  assert.ok(bounds.slot.width >= 300 && bounds.slot.width <= 321 && bounds.slot.height >= 49);
  assert.ok(bounds.slot.x >= bounds.card.x - 1 && bounds.slot.right <= bounds.card.right + 1);
  assert.ok(bounds.slot.y >= bounds.result.bottom - 1 && bounds.slot.y >= bounds.history.bottom - 1);
  assert.ok(bounds.slot.bottom <= bounds.card.bottom + 1);
  assert.ok(bounds.slot.x > bounds.first.right, 'Tablet test placement must be in the right panel');
  console.log('PASS: tablet 320x50 mock in right panel, after generated result and saved history');

  await androidTauri.context.close();
  console.log('PASS: tiny screens hide mock, demo consent never persisted and zero ad-network requests');
} finally {
  await browser.close();
}
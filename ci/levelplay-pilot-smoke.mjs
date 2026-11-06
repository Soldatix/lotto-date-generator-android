import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
  await page.setViewportSize({width:1100,height:620});
  await page.evaluate(() => {
    const slot=document.getElementById('nativeTabletBannerProbe');
    slot.closest('.resultBox').classList.add('tablet-preview-active');
    slot.hidden=false;
  });
  const initial=await page.locator('#nativeTabletBannerProbe').boundingBox();
  assert.ok(initial && initial.y >= 0 && initial.y + initial.height <= 620,
    'Landscape mock should be visible in initial 1100x620 viewport without scrolling');
  console.log('PASS: landscape first viewport shows tablet mock before scrolling');
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

  // V8.2 viewport matrix. The primary guarantee is NORMAL FLOW:
  // the banner stays below all results/history and inside the card.
  // Landscape with enough height should show it immediately; very short
  // screens may scroll instead of hiding interactive lottery controls.
  for (const [width, height] of [
    [1024,640], [1280,800], [960,600], [1100,620],
    [800,600], [768,1024], [800,1280], [600,960]
  ]) {
    await page.setViewportSize({width,height});
    await page.reload();
    await page.evaluate(() => {
      const slot=document.getElementById('nativeTabletBannerProbe');
      const panel=slot.closest('.resultBox');
      panel.classList.add('tablet-preview-active');
      slot.hidden=false;
    });
    // Use the stylesheet matrix rather than only inspecting the class.
    const box=await page.evaluate(() => {
      const rect=(x)=>x.getBoundingClientRect();
      const slot=document.getElementById('nativeTabletBannerProbe');
      const panel=slot.closest('.resultBox');
      const result=document.getElementById('resultArea');
      const history=document.getElementById('historyWrap');
      const a=rect(slot), b=rect(panel), r=rect(result);
      const h=history.hidden?null:rect(history);
      return {
        width:a.width,height:a.height,left:a.left,right:a.right,top:a.top,bottom:a.bottom,
        panelLeft:b.left,panelRight:b.right,panelBottom:b.bottom,
        resultBottom:r.bottom,historyBottom:h?.bottom||null,
        computedMarginTop:getComputedStyle(slot).marginTop,
        visibleNoScroll:a.bottom<=innerHeight,
        inLandscape:matchMedia('(orientation: landscape)').matches,
        rightOfForm:a.left>document.querySelector('.grid > .card:first-child').getBoundingClientRect().right
      };
    });
    assert.ok(box.width <= 321 && box.height >= 49 && box.height <= 51,
      'Mock dimensions invalid at '+width+'x'+height);
    assert.ok(box.left >= box.panelLeft-1 && box.right <= box.panelRight+1,
      'Banner outside result card at '+width+'x'+height);
    assert.ok(box.top >= box.resultBottom-1 &&
      (box.historyBottom===null || box.top>=box.historyBottom-1),
      'Banner overlaps results/history at '+width+'x'+height);
    assert.ok(box.bottom <= box.panelBottom+1,
      'Banner outside card bottom at '+width+'x'+height);
    if(width >= 900 && height >= 600 && box.inLandscape) {
      assert.ok(box.visibleNoScroll, 'Banner below first landscape viewport '+width+'x'+height);
      assert.ok(box.rightOfForm, 'Banner must be in the right panel at '+width+'x'+height);
      assert.ok(parseFloat(box.computedMarginTop)<=17,
        'Landscape margin must not auto-expand at '+width+'x'+height);
    }
  }
  console.log('PASS: V8.2 responsive tablet mock 8 viewport matrix, no result/history overlap');

  // N5: evaluate the EXACT JS embedded in the Kotlin Android debug host.
  // Uses synthetic Tauri and ADB-third-flag substitution in Chromium tests
  // only; production apps and ordinary N1/N2 launches never activate it.
  const n5Kotlin=readFileSync(new URL('../src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/NativeBannerHostProbe.kt',import.meta.url),'utf8');
  const n5Match=n5Kotlin.match(/val script = """([\s\S]*?)"""\.trimIndent\(\)\.replace\("__N5_PORTRAIT_RAIL__", n5Requested\.toString\(\)\)/);
  assert.ok(n5Match,'Expected Android Kotlin N5 debug JS source');
  const noAdsJavaScript=n5Match[1].replace('__N5_PORTRAIT_RAIL__','true');
  const defaultJavaScript=n5Match[1].replace('__N5_PORTRAIT_RAIL__','false');

  await page.setViewportSize({width:640,height:1024});
  await page.reload();
  assert.equal(await page.evaluate(source=>window.eval(source),defaultJavaScript),true);
  assert.equal(await page.locator('#nativeTabletBannerProbe').evaluate(el=>el.parentElement.classList.contains('resultBox')),true);
  assert.equal(await page.evaluate(()=>Boolean(window.__dateLottoN5RailInstalled)),false);
  console.log('PASS: N5 default disabled leaves original portrait in-panel slot unchanged');

  await page.reload();
  assert.equal(await page.evaluate(source=>window.eval(source),noAdsJavaScript),true);
  let n5=await page.evaluate(()=>{
    const slot=document.getElementById('nativeTabletBannerProbe');
    const cards=Array.from(document.querySelectorAll('.grid>.card')).map(x=>x.getBoundingClientRect().toJSON());
    const r=slot.getBoundingClientRect();
    return {parent:slot.parentElement.className,width:r.width,top:r.top,bottom:r.bottom,
      cardBottom:Math.max(...cards.map(x=>x.bottom)),hidden:slot.hidden,
      viewport:innerWidth,scroll:scrollY};
  });
  assert.match(n5.parent,/n5-tablet-portrait-rail/);
  assert.equal(n5.hidden,false);
  assert.ok(n5.width>=319 && n5.width<=321,'N5 640px portrait must reserve full 320 CSS px');
  assert.ok(n5.top >= n5.cardBottom - 1,'Portrait rail must follow BOTH app cards in normal flow');
  console.log('PASS: N5 640x1024 portrait full-width rail preserves results and controls');

  await page.setViewportSize({width:1024,height:640});
  await page.waitForFunction(()=>{
    const slot=document.getElementById('nativeTabletBannerProbe');
    return innerWidth===1024 && slot.parentElement.classList.contains('resultBox');
  });
  assert.equal(await page.locator('#nativeTabletBannerProbe').isHidden(),false);
  console.log('PASS: N5 landscape rotates back to original right-panel reservation');

  await page.setViewportSize({width:480,height:800});
  await page.waitForFunction(()=>{
    const slot=document.getElementById('nativeTabletBannerProbe');
    return innerWidth===480 && slot.parentElement.classList.contains('grid');
  });
  n5=await page.locator('#nativeTabletBannerProbe').boundingBox();
  assert.ok(n5 && n5.width>=319 && n5.width<=321,'N5 480px portrait should fit 320px');
  console.log('PASS: N5 narrow portrait 480x800 supports full standard banner width');

  await page.setViewportSize({width:300,height:650});
  await page.waitForFunction(()=>{
    const slot=document.getElementById('nativeTabletBannerProbe');
    return innerWidth===300 && slot.hidden;
  });
  assert.equal(await page.locator('#nativeTabletBannerProbe').isHidden(),true);
  assert.equal(blocked.filter(x=>/unity|ironsource|levelplay|admob|applovin/i.test(x)).length,0);
  console.log('PASS: N5 300px screen fails closed: banner mock hidden; no ad requests');

  await androidTauri.context.close();
  console.log('PASS: tiny screens hide mock, demo consent never persisted and zero ad-network requests');
} finally {
  await browser.close();
}
// Temporary CSS placement test in isolated Huawei Date Lotto debug WebView.
// Only temporary in-memory CSS changes. No APK install, storage, real ads, or app-network requests. Restores ADB forwarding.
import { spawnSync } from 'node:child_process';

const pkg='org.appsandgames.datelottogenerator.levelplaypilot';
const adbExe=process.env.ADB_EXE ||
  (String(process.env.LOCALAPPDATA)+'\\Android\\Sdk\\platform-tools\\adb.exe');

function adb(args,{allowFailure=false}={}) {
  const p=spawnSync(adbExe,args,{encoding:'utf8',timeout:20000,windowsHide:true});
  if(p.error) throw p.error;
  const out=(p.stdout||'').trim(), err=(p.stderr||'').trim();
  if(p.status!==0&&!allowFailure) throw new Error('ADB_FAILED '+args.join(' ')+' '+err+' '+out);
  return {code:p.status,out,err};
}

function liveProofExpression(){
  // This function runs INSIDE only the isolated debug Tauri WebView.
  const slot=document.getElementById('nativeTabletBannerProbe');
  const card=document.querySelector('.resultBox');
  const result=document.getElementById('resultArea');
  const history=document.getElementById('historyWrap');
  if(location.hostname!=='tauri.localhost') return {error:'NOT_TAURI_LOCALHOST'};
  if(!slot||!card||!result||slot.hidden) return {error:'EXPECTED_VISIBLE_TABLET_TEST_SLOT_MISSING'};
  if(!card.classList.contains('tablet-preview-active')) return {error:'DEBUG_TABLET_CLASS_NOT_ACTIVE'};
  const query='(orientation: landscape) and (min-width: 851px)';
  if(!matchMedia(query).matches) return {error:'ROTATE_TABLET_TO_LANDSCAPE'};

  function rect(el){
    if(!el) return null;
    const b=el.getBoundingClientRect();
    return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),
      width:+b.width.toFixed(1),height:+b.height.toFixed(1),
      bottom:+b.bottom.toFixed(1),documentY:+(b.y+scrollY).toFixed(1)};
  }
  function metrics(){
    const a=rect(slot),r=rect(result),h=history&&!history.hidden?rect(history):null;
    const c=rect(card),s=getComputedStyle(slot),rs=getComputedStyle(result);
    return {
      viewport:{width:innerWidth,height:innerHeight,scrollY},
      slot:a,result:r,history:h,card:c,
      marginTop:s.marginTop,marginBottom:s.marginBottom,
      resultMarginTop:rs.marginTop,resultMarginBottom:rs.marginBottom,
      withinRightCard:!!a&&!!c&&a.x>=c.x-1&&a.x+a.width<=c.x+c.width+1,
      belowContent:!!a&&!!r&&a.y>=r.bottom-1&&(!h||a.y>=h.bottom-1),
      visibleAtTop:!!a&&a.documentY>=0&&a.documentY+a.height<=innerHeight-25
    };
  }
  const before=metrics();

  let v81RuleFound=false;
  let readableSheets=0;
  for(const sheet of document.styleSheets){
    try {
      const rules=sheet.cssRules;
      readableSheets++;
      for(const rule of rules){
        const t=rule.cssText||'';
        if(t.includes('.resultBox.tablet-preview-active')&&
           t.includes('.native-tablet-banner-probe')) v81RuleFound=true;
      }
    }catch{/* not a local inspectable CSS sheet */}
  }

  // Live visual experiment ONLY: does not change repo, storage or APK.
  // Navigating, refreshing or force-stopping the test app removes this style.
  const style=document.createElement('style');
  style.id='date-lotto-debug-temporary-landscape-fix';
  style.textContent=
    '@media (orientation: landscape) and (min-width: 851px) {'+
    ' .resultBox.tablet-preview-active #resultArea.empty {'+
    ' margin: 14px auto 12px !important; }'+
    ' .resultBox.tablet-preview-active .native-tablet-banner-probe {'+
    ' margin: 14px auto 0 !important; }'+
    '}';
  const existing=document.getElementById(style.id);
  if(existing) existing.remove();
  document.head.appendChild(style);
  const after=metrics();
  return {
    v81RuleFound,readableSheets,before,after,
    improved:!before.visibleAtTop&&after.visibleAtTop,
    placementPass:after.visibleAtTop&&after.withinRightCard&&after.belowContent,
    ephemeralOnly:true
  };
}
async function cdpEvaluate(url,expression){
  return await new Promise((resolve,reject)=>{
    const ws=new WebSocket(url);
    const timer=setTimeout(()=>{ws.close();reject(new Error('CDP_TIMEOUT'));},12000);
    let settled=false;
    const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);try{ws.close();}catch{};error?reject(error):resolve(value);};
    ws.addEventListener('open',()=>ws.send(JSON.stringify({
      id:1,method:'Runtime.evaluate',
      params:{expression:'('+expression.toString()+')()',returnByValue:true}
    })));
    ws.addEventListener('error',()=>done(new Error('CDP_WEBSOCKET_ERROR')));
    ws.addEventListener('message',event=>{
      try {
        const msg=JSON.parse(event.data);
        if(msg.id!==1) return;
        if(msg.error||msg.result?.exceptionDetails) {
          return done(new Error('CDP_EVALUATION_FAILED '+JSON.stringify(msg.error||msg.result.exceptionDetails)));
        }
        done(null,msg.result?.result?.value);
      } catch(e){done(e);}
    });
  });
}

console.log('=== DATE LOTTO HUAWEI LIVE CSS PROOF ===');
console.log('NO_BUILD=TRUE; NO_INSTALL=TRUE; NO_AD_REQUESTS=TRUE; TEMPORARY_CSS_ONLY=TRUE');
let forwarded=null, serial=null;
try {
  const devices=adb(['devices']).out.matchAll(/^(\S+)\s+device\s*$/gm);
  const ids=[...devices].map(x=>x[1]);
  if(ids.length!==1) throw new Error('EXPECTED_ONE_AUTHORIZED_DEVICE');
  serial=ids[0];
  const deviceArgs=['-s',serial];
  const shell=(...args)=>adb([...deviceArgs,'shell',...args]);
  if(shell('getprop','ro.product.model').out!=='CMR-W09') throw new Error('NOT_HUAWEI_CMR_W09');
  const pid=shell('pidof','-s',pkg).out;
  if(!/^\d+$/.test(pid)) throw new Error('PILOT_APP_NOT_RUNNING');
  console.log('PILOT_APP_RUNNING=TRUE');

  const unix=shell('cat','/proc/net/unix').out;
  const sock='webview_devtools_remote_'+pid;
  if(!unix.includes(sock)) {
    console.log('WEBVIEW_DEBUG_SOCKET=UNAVAILABLE');
    console.log('INFERENCE=No WebView DevTools socket visible; no layout values could be read');
    process.exitCode=2;
  } else {
    const p=adb([...deviceArgs,'forward','tcp:0','localabstract:'+sock]).out;
    if(!/^\d+$/.test(p)) throw new Error('ADB_FORWARD_PORT_NOT_RETURNED');
    forwarded=p;
    const response=await fetch('http://127.0.0.1:'+p+'/json/list',{signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new Error('DEVTOOLS_HTTP_'+response.status);
    const targets=await response.json();
    const target=targets.find(t=>t.type==='page'&&/tauri\.localhost|tauri:\/\//i.test(t.url||''))
      || targets.find(t=>t.type==='page');
    if(!target?.webSocketDebuggerUrl) throw new Error('TAURI_WEBVIEW_TARGET_NOT_FOUND');
    const wsUrl=new URL(target.webSocketDebuggerUrl);
    wsUrl.hostname='127.0.0.1';
    wsUrl.port=p;
    const data=await cdpEvaluate(wsUrl.toString(),liveProofExpression);
    if(!data) throw new Error('CDP_EMPTY_RESULT');
    if(data.error) throw new Error('LAYOUT_PROOF_PRECONDITION='+data.error);
    console.log('V81_RULE_FOUND_IN_STYLESHEETS='+data.v81RuleFound);
    console.log('READABLE_STYLESHEETS='+data.readableSheets);
    console.log('BEFORE_BANNER_MARGIN='+data.before.marginTop);
    console.log('BEFORE_BANNER_Y='+data.before.slot?.documentY);
    console.log('BEFORE_VISIBLE='+data.before.visibleAtTop);
    console.log('AFTER_BANNER_MARGIN='+data.after.marginTop);
    console.log('AFTER_BANNER_Y='+data.after.slot?.documentY);
    console.log('AFTER_VISIBLE='+data.after.visibleAtTop);
    console.log('AFTER_BELOW_RESULTS_AND_HISTORY='+data.after.belowContent);
    console.log('AFTER_WITHIN_RIGHT_CARD='+data.after.withinRightCard);
    console.log('VISUAL_PLACEMENT_PASS='+data.placementPass);
    console.log('TEMP_CSS_ACTIVE_UNTIL_APP_REFRESH_OR_RESTART=TRUE');
    console.log('LAYOUT_PROOF='+JSON.stringify(data));
    console.log('=== LIVE PROOF COMPLETE ===');
  }
} catch(err) {
  console.error('READ_ONLY_DIAGNOSTIC_ERROR='+err.message);
  process.exitCode=1;
} finally {
  if(forwarded && serial) {
    try{adb(['-s',serial,'forward','--remove','tcp:'+forwarded]);}
    catch(e){console.error('ADB_FORWARD_CLEANUP_WARNING='+e.message);}
  }
}

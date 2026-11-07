// Read-only Huawei Date Lotto debug layout inspection via Android WebView DevTools.
// No app state change, no APK install, no ad network calls. Restores temporary ADB port-forward.
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

function inspectExpression(){
  const rect=(el)=>{if(!el) return null;const b=el.getBoundingClientRect();return {
    x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height),
    bottom:Math.round(b.bottom),documentTop:Math.round(b.top+window.scrollY)
  };};
  const slot=document.getElementById('nativeTabletBannerProbe');
  const card=document.querySelector('.resultBox');
  const result=document.getElementById('resultArea');
  const history=document.getElementById('historyWrap');
  const slotStyle=slot?getComputedStyle(slot):null;
  const resultStyle=result?getComputedStyle(result):null;
  const sr=rect(slot);
  return {
    hostname:location.hostname,
    viewport:{width:innerWidth,height:innerHeight,scrollY:Math.round(scrollY),
      dpr:devicePixelRatio,orientation:screen.orientation?.type||'unknown'},
    mediaLandscape:matchMedia('(orientation: landscape) and (min-width: 851px)').matches,
    cardActive:card?.classList.contains('tablet-preview-active')||false,
    slotHidden:slot?.hidden??null,
    card:rect(card),result:rect(result),history:history?.hidden?null:rect(history),
    slot:sr,
    slotStyles:slotStyle?{marginTop:slotStyle.marginTop,marginBottom:slotStyle.marginBottom,
      display:slotStyle.display,position:slotStyle.position}:null,
    resultStyles:resultStyle?{marginTop:resultStyle.marginTop,marginBottom:resultStyle.marginBottom}:null,
    visibleAtScrollZero:!!sr && sr.documentTop>=0 && sr.documentTop+sr.height<=innerHeight,
    serviceWorkerControlled:!!navigator.serviceWorker?.controller
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

console.log('=== DATE LOTTO HUAWEI LAYOUT READ ONLY ===');
console.log('NO_BUILD=TRUE; NO_INSTALL=TRUE; NO_AD_REQUESTS=TRUE');
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
    const data=await cdpEvaluate(wsUrl.toString(),inspectExpression);
    if(!data) throw new Error('CDP_EMPTY_RESULT');
    console.log('VIEWPORT_WIDTH='+data.viewport.width);
    console.log('VIEWPORT_HEIGHT='+data.viewport.height);
    console.log('CURRENT_SCROLL_Y='+data.viewport.scrollY);
    console.log('LANDSCAPE_CSS_ACTIVE='+data.mediaLandscape);
    console.log('TABLET_PREVIEW_CLASS_ACTIVE='+data.cardActive);
    console.log('BANNER_HIDDEN='+data.slotHidden);
    console.log('BANNER_MARGIN_TOP='+data.slotStyles?.marginTop);
    console.log('BANNER_DOCUMENT_Y='+data.slot?.documentTop);
    console.log('VISIBLE_WITHOUT_SCROLL='+data.visibleAtScrollZero);
    console.log('SERVICE_WORKER_CONTROLLED='+data.serviceWorkerControlled);
    console.log('LAYOUT='+JSON.stringify(data));
    console.log('=== READ ONLY COMPLETE ===');
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

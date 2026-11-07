// N2-T Huawei native-anchor follow-up: collect only three previously unverified
// visual states. SDK-free debug package ONLY. No build, install, ad SDK or
// publisher IDs. The second opt-in is reissued after a guarded test-only launch.
import {spawnSync} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {stdin, stdout} from 'node:process';

const pkg='org.appsandgames.datelottogenerator.levelplaypilot';
const production='org.appsandgames.datelottogenerator';
const e1='org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE';
const e2='org.appsandgames.datelottogenerator.DEBUG_NATIVE_ANCHORED_PREVIEW';
const adbExe=process.env.ADB_EXE ||
  join(process.env.LOCALAPPDATA||'', 'Android','Sdk','platform-tools','adb.exe');
const folder=join(process.env.USERPROFILE||'', 'Downloads',
  'DateLotto-N2-Targeted-'+new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(folder,{recursive:true});

function run(args,binary=false){
  const p=spawnSync(adbExe,args,{windowsHide:true,encoding:null,timeout:60000,maxBuffer:32*1024*1024});
  if(p.error||p.status!==0) throw new Error('ADB_FAILED: '+args.join(' ')+' '+String(p.stderr||p.error));
  return binary?p.stdout:String(p.stdout).trim();
}
const devices=[...run(['devices']).matchAll(/^(\S+)\s+device\s*$/gm)].map(m=>m[1]);
if(devices.length!==1) throw new Error('EXACTLY_ONE_AUTHORIZED_DEVICE_REQUIRED');
const serial=devices[0];
const adb=(...args)=>run(['-s',serial,...args]);
const shell=(...args)=>adb('shell',...args);
if(shell('getprop','ro.product.model')!=='CMR-W09' ||
   shell('getprop','ro.build.version.sdk')!=='28') throw new Error('HUAWEI_CMR_W09_ANDROID9_REQUIRED');
const pkgList=shell('pm','list','packages');
const hasPackage=p=>pkgList.split(/\r?\n/).includes('package:'+p);
if(!hasPackage(pkg)) throw new Error('ISOLATED_PILOT_NOT_INSTALLED');
const prodBefore=hasPackage(production);
const rl=createInterface({input:stdin,output:stdout});
let forwarded=null;
const records=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));

function pngDimensions(data){
  if(data.length<24 || data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
    throw new Error('INVALID_PNG_SCREENSHOT');
  return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
}
async function prompt(message){
  await rl.question('\n'+message+'\nPress ENTER when the actual tablet screen is ready: ');
  await pause(750);
}

async function evaluate(wsUrl,expr){
  return await new Promise((resolve,reject)=>{
    const ws=new WebSocket(wsUrl);
    let done=false;
    const timer=setTimeout(()=>finish(new Error('WEBVIEW_EVALUATE_TIMEOUT')),15000);
    function finish(err,val){
      if(done)return;done=true;clearTimeout(timer);
      try{ws.close();}catch{}
      if(err) reject(err);else resolve(val);
    }
    ws.addEventListener('open',()=>ws.send(JSON.stringify({
      id:1,method:'Runtime.evaluate',
      params:{expression:'('+expr.toString()+')()',returnByValue:true}
    })));
    ws.addEventListener('error',()=>finish(new Error('WEBVIEW_CDP_CONNECTION_FAILED')));
    ws.addEventListener('message',event=>{
      try{
        const m=JSON.parse(event.data);
        if(m.id!==1)return;
        if(m.error||m.result?.exceptionDetails)
          return finish(new Error('WEBVIEW_CDP_EXPRESSION_FAILED'));
        finish(null,m.result?.result?.value);
      }catch(err){finish(err)}
    });
  });
}

function browserGeometry(){
  if(location.hostname!=='tauri.localhost') return {error:'NOT_TAURI_LOCALHOST'};
  const slot=document.getElementById('nativeTabletBannerProbe');
  if(!slot||slot.hidden) return {error:'NATIVE_TABLET_SLOT_MISSING'};
  const r=slot.getBoundingClientRect();
  const style=getComputedStyle(slot);
  const visible=style.display!=='none'&&style.visibility!=='hidden'&&
    r.left<innerWidth&&r.right>0&&r.top<innerHeight&&r.bottom>0;
  return {
    innerWidth,innerHeight,scrollY,visible,
    rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},
    hasTabletClass:!!slot.closest('.resultBox.tablet-preview-active'),
    orientation:matchMedia('(orientation:portrait)').matches?'portrait':'landscape'
  };
}

let wsUrl;
async function getGeometry(){
  if(!wsUrl) return {error:'CDP_SOCKET_UNAVAILABLE'};
  try{return await evaluate(wsUrl,browserGeometry)}
  catch(e){return {error:e.message}}
}

function imeEvidence(text){
  // OEM names vary; report UNKNOWN rather than assuming a keyboard is visible.
  const matches=[...text.matchAll(/\b(?:mInputShown|mInputViewShown|mIsInputViewShown|isInputViewShown)\s*=\s*(true|false)\b/g)];
  if(matches.some(m=>m[1]==='true'))return 'TRUE';
  if(matches.some(m=>m[1]==='false'))return 'FALSE';
  return 'UNKNOWN';
}

async function capture(name,expected){
  const bytes=run(['-s',serial,'exec-out','screencap','-p'],true);
  const dims=pngDimensions(bytes);
  const snapshot=join(folder,name+'.png');
  writeFileSync(snapshot,bytes);
  const geom=await getGeometry();
  const imeDump=shell('dumpsys','input_method');
  const ime=imeEvidence(imeDump);
  writeFileSync(join(folder,name+'-inputmethod.txt'),imeDump);
  writeFileSync(join(folder,name+'-layout.json'),JSON.stringify(geom,null,2));
  const screenOrientation=dims.height>dims.width?'portrait':'landscape';
  const orientationOK=expected.orientation===screenOrientation;
  const offscreenOK=expected.offscreen===undefined?null:
    geom.error?null:geom.visible===false;
  const state={name,screenOrientation,screenPixels:dims,orientationOK,
    offscreenOK,ime,geom,screen:snapshot};
  records.push(state);
  console.log('STAGE='+name+
    '; SCREEN='+dims.width+'x'+dims.height+
    '; ORIENTATION_VERIFIED='+orientationOK+
    '; SLOT_OFFSCREEN_VERIFIED='+String(offscreenOK)+
    '; IME_VISIBLE_REPORTED='+ime);
  return state;
}

console.log('=== DATE LOTTO N2-T THREE MISSING STATES ===');
console.log('NO_BUILD=TRUE; NO_INSTALL=TRUE; SDK=OFF; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE');
try{
  // Restart only the known isolated debug app: never touches user data or production package.
  const component=pkg+'/org.appsandgames.datelottogenerator.MainActivity';
  const start=shell('am','start','-S','-W','-n',component,
      '--ez',e1,'true','--ez',e2,'true');
  if(!/Status:\s*ok/.test(start))throw new Error('ISOLATED_N1_RESTART_FAILED');
  await pause(4000);
  const pid=shell('pidof','-s',pkg);
  if(!/^\d+$/.test(pid))throw new Error('ISOLATED_APP_NOT_RUNNING');
  const firstLogs=adb('logcat','-d','-v','brief','--pid='+pid,'-t','2000',
      '-s','DateLottoNativeAnchor:V','DateLottoNativeHost:V','*:S');
  if(!firstLogs.includes('NATIVE_ANCHOR=STARTED_NO_ADS'))
    throw new Error('N1_NATIVE_ANCHOR_NOT_STARTED');

  // CDP is read-only. Temporary loopback forward removed on exit.
  try {
    const socket='webview_devtools_remote_'+pid;
    if(shell('cat','/proc/net/unix').includes(socket)){
      forwarded=adb('forward','tcp:0','localabstract:'+socket);
      if(/^\d+$/.test(forwarded)){
        const rsp=await fetch('http://127.0.0.1:'+forwarded+'/json/list');
        const targets=await rsp.json();
        const target=targets.find(t=>t.type==='page'&&/tauri\.localhost/i.test(t.url||''))
          || targets.find(t=>t.type==='page');
        if(target?.webSocketDebuggerUrl){
          const u=new URL(target.webSocketDebuggerUrl);
          u.hostname='127.0.0.1';u.port=forwarded;wsUrl=u.toString();
        }
      }
    }
  }catch(e){console.log('CDP_DIAGNOSTIC=UNAVAILABLE '+e.message)}
  console.log('ISOLATED_N1_ACTIVE=TRUE; CDP_AVAILABLE='+Boolean(wsUrl));
  console.log('REPORT_DIRECTORY='+folder);

  await prompt('STAGE 1/3: Enable AUTO-ROTATE and physically turn Huawei PORTRAIT.\nThe display must be TALLER than it is wide.');
  let portrait=await capture('01-portrait',{orientation:'portrait'});
  if(!portrait.orientationOK){
    await prompt('PORTRAIT NOT DETECTED. Check Huawei rotation lock, turn vertically, then retry.');
    portrait=await capture('01-portrait-retry',{orientation:'portrait'});
  }
  console.log('PORTRAIT_CONFIRMED='+portrait.orientationOK);

  await prompt('STAGE 2/3: Turn LANDSCAPE. Generate/save enough combinations so the\nblue native banner is COMPLETELY OFF-SCREEN, then keep that position.');
  let hidden=await capture('02-banner-offscreen',{orientation:'landscape',offscreen:true});
  if(hidden.offscreenOK!==true){
    await prompt('OFFSCREEN NOT VERIFIED. Scroll or add more saved combinations until\nneither the blue native label nor its banner slot is in the visible screen.');
    hidden=await capture('02-banner-offscreen-retry',{orientation:'landscape',offscreen:true});
  }
  console.log('OFFSCREEN_CONFIRMED='+String(hidden.offscreenOK));

  await prompt('STAGE 3/3: Keep LANDSCAPE, tap the OPTIONAL PERSONAL KEY text field.\nThe actual Android on-screen keyboard must be OPEN in the screenshot.');
  let keyboard=await capture('03-keyboard-visible',{orientation:'landscape'});
  if(keyboard.ime!=='TRUE'){
    await prompt('SOFT KEYBOARD NOT CONFIRMED by Android. Tap Optional personal key\nand check keyboard keys are visibly on screen; try once more.');
    keyboard=await capture('03-keyboard-visible-retry',{orientation:'landscape'});
  }
  console.log('ANDROID_IME_REPORTED='+keyboard.ime);

  const finalProd=shell('pm','list','packages').split(/\r?\n/).includes('package:'+production);
  if(finalProd!==prodBefore)throw new Error('PRODUCTION_PACKAGE_STATE_CHANGED');
  const finalPid=shell('pidof','-s',pkg);
  const samePid=finalPid===pid;
  const lastLogs=adb('logcat','-d','-v','time','--pid='+pid,'-t','3000',
    '-s','DateLottoNativeAnchor:V','DateLottoNativeHost:V','*:S');
  writeFileSync(join(folder,'N2-T-native-logs.txt'),lastLogs);
  const final={portraitConfirmed:portrait.orientationOK,
    offscreenConfirmed:hidden.offscreenOK,
    keyboardReported:keyboard.ime,
    samePilotProcess:samePid,productionUnchanged:true,realAdsOff:true,
    note:'Screenshots require visual review; IME UNKNOWN is not a pass.'};
  writeFileSync(join(folder,'N2-T-summary.json'),JSON.stringify({final,records},null,2));
  console.log('\n=== N2-T RESULT ===');
  console.log('PORTRAIT_CONFIRMED='+final.portraitConfirmed);
  console.log('BANNER_OFFSCREEN_CONFIRMED='+String(final.offscreenConfirmed));
  console.log('KEYBOARD_IME_REPORTED='+final.keyboardReported);
  console.log('SAME_PILOT_PROCESS='+final.samePilotProcess);
  console.log('PRODUCTION_PACKAGE_STATE=UNCHANGED');
  console.log('REPORT_DIRECTORY='+folder);
  console.log('VISUAL_REVIEW_REQUIRED=TRUE; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE');
}catch(e){
  console.error('N2_TARGETED_HOLD='+e.message);
  process.exitCode=1;
}finally{
  if(forwarded){
    try{run(['-s',serial,'forward','--remove','tcp:'+forwarded])}
    catch(e){console.error('ADB_FORWARD_CLEANUP_WARNING='+e.message)}
  }
  rl.close();
}

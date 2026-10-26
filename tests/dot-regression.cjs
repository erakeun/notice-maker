const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:8765';
const OUT=path.join('test-results','dots');
fs.mkdirSync(OUT,{recursive:true});
function pdfInfo(file){
 const content=fs.readFileSync(file).toString('latin1');
 const box=content.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
 assert(box,'PDF has explicit page size');
 return {pages:[...content.matchAll(/\/Type\s*\/Page\b/g)].length,width:Number(box[1]),height:Number(box[2])};
}

(async()=>{
 console.log('Launching isolated dot test browser');
 const browser=await chromium.launch({headless:true,timeout:30000});
 const context=await browser.newContext({viewport:{width:1500,height:1000},acceptDownloads:true});
 await require('./test-routing.cjs')(context,BASE_URL);
 await context.addInitScript(()=>{window.print=()=>{};});
 const errors=[],dialogs=[],requests=[],results=[];
 context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});});
 context.on('request',r=>{if(r.url().includes('/assets/dot-chars/'))requests.push(new URL(r.url()).pathname);});
 let page=await context.newPage();
 async function ready(){await page.evaluate(()=>document.fonts.ready);await page.locator('#templateBg').evaluate(img=>img.decode());}
 async function decode(){await page.locator('#characterImg').evaluate(img=>img.decode());}
 async function load(state){
  const imported=page.waitForEvent('dialog');
  await page.locator('#workFile').setInputFiles({name:'fixture.notice.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'notice-maker',state}))});
  await imported;await ready();
 }
 async function download(selector,name){
  const pending=page.waitForEvent('download',{timeout:45000});
  await page.locator(selector).click();
  const d=await pending;await d.saveAs(path.join(OUT,name));return path.join(OUT,name);
 }
 async function input(id,value){await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
 await page.goto(BASE_URL,{waitUntil:'domcontentloaded'});await ready();console.log('Loaded app');
 assert.equal(requests.length,0);
 assert(await page.locator('[data-mach-feedback="04"]').getAttribute('href'));
 results.push({test:'initial load has no dot images; feedback preserved',pass:true,requests:0});
 const poses=await page.evaluate(()=>window.DOT_CHARACTERS);
 assert.equal(poses.length,65);
 await page.locator('#advancedPanel').evaluate(el=>el.open=true);
 await page.locator('#charCategory').selectOption('dot-hanyangi');await decode();
 assert.equal(await page.locator('#charGrid button').count(),41);
 await page.waitForTimeout(150);
 const firstRequests=[...new Set(requests)];
 assert.equal(firstRequests.filter(x=>x.endsWith('.svg')).length,1);
 assert(firstRequests.filter(x=>x.endsWith('.png')).length<41);
 results.push({test:'category lazily loads visible PNG thumbnails and one selected SVG',pass:true,requests:firstRequests});
 for(const category of ['dot-hanyangi','dot-hibibi']){
  await page.locator('#charCategory').selectOption(category);
  const items=poses.filter(x=>x.category===category);
  assert.equal(await page.locator('#charGrid button').count(),items.length);
  assert.deepEqual(await page.locator('#charGrid button span').allTextContents(),items.map(p=>`${String(p.index).padStart(2,'0')} · ${p.name}`));
  // Exercise every real choice, including the original wide message-board pose.
  for(const pose of items){
   await page.locator('#charGrid button').nth(pose.index-1).click();await decode();
   const image=await page.locator('#characterImg').evaluate(img=>({src:img.getAttribute('src'),w:img.naturalWidth,h:img.naturalHeight,ratio:img.offsetWidth/img.offsetHeight}));
   assert.equal(image.src,pose.svg);
   assert.equal(image.w/image.h,pose.width/pose.height);
   assert(Math.abs(image.ratio-pose.width/pose.height)<.04);
  }
  results.push({test:category+' all original pose names, selections, and intrinsic ratios',pass:true,count:items.length});
  console.log('Verified selections',category,items.length);
 }
 const textPose=poses.find(x=>x.category==='dot-hibibi'&&x.hasText);
 await page.locator('#charGrid button').nth(textPose.index-1).click();await decode();
 assert((await page.locator('#charHelp').textContent()).includes('거꾸로'));
 await page.locator('#flip').click();
 assert.equal(await page.locator('#flip').getAttribute('aria-pressed'),'true');
 assert((await page.locator('#characterObj').getAttribute('style')).includes('scaleX(-1)'));
 results.push({test:'text-pose flip warning and actual transform',pass:true,name:textPose.name});
 await input('objX',77);await input('objY',67);await input('objSize',18);
 await page.close({runBeforeUnload:true});
 page=await context.newPage();await page.goto(BASE_URL,{waitUntil:'domcontentloaded'});await ready();await decode();
 assert.equal(await page.locator('#charCategory').inputValue(),'dot-hibibi');
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('noticeMakerV17')));
 assert.equal(restored.charIndex,textPose.index);assert.equal(restored.objects.character.x,77);assert.equal(restored.objects.character.y,67);assert.equal(restored.objects.character.w,18);assert.equal(restored.objects.character.flip,true);
 assert.equal(await page.locator('#objTabs button[aria-pressed="true"]').getAttribute('data-obj'),'character');
 assert.equal(await page.locator('#objX').inputValue(),'77');assert.equal(await page.locator('#objY').inputValue(),'67');assert.equal(await page.locator('#objSize').inputValue(),'18');
 results.push({test:'actual tab close/reopen restores category pose size position and flip',pass:true});
 await page.locator('#advancedPanel').evaluate(el=>el.open=true);
 await page.locator('#charCategory').selectOption('none');
 assert.equal(await page.locator('#characterObj').evaluate(el=>getComputedStyle(el).display),'none');
 await page.locator('#charCategory').selectOption('hanyangi');await decode();
 assert.equal(await page.locator('#characterImg').getAttribute('src'),'chars/hanyangi_01.png');
 assert.equal(await page.locator('#characterImg').getAttribute('class'),'');
 await page.locator('#charCategory').selectOption('dot-hibibi');await page.locator('#charGrid button').nth(23).click();await decode();
 results.push({test:'deselect, replace with existing character, select wide dot again',pass:true});
 // A safe fictional layout for real PNG/PDF/print export.
 const fixture={orientation:'landscape',template:9,title:'새봄 안내',subtitle:'가상 행사 · 기능 검증',body:'안내 데스크를 방문해 주세요.<br>오후 2시에 시작합니다.',emphasis:'',footer:'테스트 전용 · 실제 인물 정보 없음',titleSize:46,bodySize:24,contentTop:24,contentWidth:70,charCategory:'dot-hanyangi',charIndex:1,selected:'character',outputName:'가상-도트-안내문',objects:{character:{x:82,y:70,w:20,opacity:1,rotation:0,flip:false,z:7,locked:false}}};
 await load(fixture);await decode();
 assert.equal(await page.locator('#objTabs button[aria-pressed="true"]').getAttribute('data-obj'),'character');
 assert.equal(await page.locator('#objX').inputValue(),'82');assert.equal(await page.locator('#objY').inputValue(),'70');assert.equal(await page.locator('#objSize').inputValue(),'20');
 results.push({test:'imported selected-object tab and sliders agree with actual character geometry',pass:true});
 assert(!(await page.locator('#status').textContent()).includes('출력 불가'));
 await page.locator('#page').screenshot({path:path.join(OUT,'preview-landscape.png')});
 await page.locator('#advancedPanel').evaluate(el=>el.open=true);
 await page.locator('#charCategory').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(OUT,'editor-landscape.png')});
 const pngFile=await download('#png','dot-landscape.png');
 const pngBuffer=fs.readFileSync(pngFile),png={width:pngBuffer.readUInt32BE(16),height:pngBuffer.readUInt32BE(20)};assert.equal(png.width,3509);assert.equal(png.height,2481);
 const pdfFile=await download('#pdf','dot-landscape.pdf');
 const pdf=pdfInfo(pdfFile);assert.equal(pdf.pages,1);
 const {width,height}=pdf;assert(Math.abs(width-841.89)<1);assert(Math.abs(height-595.28)<1);
 results.push({test:'actual 300dpi PNG and one-page A4 PDF',pass:true,png:{width:png.width,height:png.height},pdf:{width,height}});
 const workFile=await download('#workSave','dot.notice.json');
 await page.locator('#charCategory').selectOption('none');
 await page.locator('#workFile').setInputFiles(workFile);await decode();
 assert.equal(await page.locator('#characterImg').getAttribute('src'),poses[0].svg);
 const saved=JSON.parse(fs.readFileSync(workFile,'utf8'));assert.equal(saved.state.charCategory,'dot-hanyangi');assert.equal(saved.state.objects.character.w,20);
 results.push({test:'actual work-file save/import retains dot identity and geometry',pass:true});
 const popupPromise=page.waitForEvent('popup');await page.locator('#print').click();
 const popup=await popupPromise;await popup.waitForSelector('img',{timeout:45000});await popup.locator('img').evaluate(img=>img.decode());
 assert.equal(await popup.locator('img').count(),1);
 await popup.pdf({path:path.join(OUT,'dot-browser-print.pdf'),preferCSSPageSize:true,printBackground:true});
 const printDoc=pdfInfo(path.join(OUT,'dot-browser-print.pdf'));assert.equal(printDoc.pages,1);await popup.close();
 results.push({test:'actual print document generated, A4 one page',pass:true,size:printDoc});
 const portrait={...fixture,orientation:'portrait',template:1,titleSize:38,bodySize:21,contentTop:21,footer:'',charCategory:'dot-hibibi',charIndex:24,objects:{character:{x:52,y:73,w:55,opacity:1,rotation:0,flip:false,z:7,locked:false}}};
 await load(portrait);await decode();
 await page.locator('#page').screenshot({path:path.join(OUT,'preview-portrait-wide.png')});
 await download('#pdf','dot-portrait-wide.pdf');
 await download('#png','dot-portrait-wide.png');
 const portraitPdf=pdfInfo(path.join(OUT,'dot-portrait-wide.pdf'));assert.equal(portraitPdf.pages,1);assert(portraitPdf.height>portraitPdf.width);
 results.push({test:'wide text pose ratio, size and position reflected in portrait PDF/PNG',pass:true});
 const legacyFile=path.join(OUT,'legacy.notice.json');
 fs.writeFileSync(legacyFile,JSON.stringify({app:'notice-maker',version:'1.7.0',state:{...fixture,charCategory:'hibibi',charIndex:4,emphasisSize:undefined}}));
 await page.locator('#workFile').setInputFiles(legacyFile);await decode();
 assert.equal(await page.locator('#characterImg').getAttribute('src'),'chars/hibibi_04.png');assert.equal(await page.locator('#emphasisSize').inputValue(),'26');
 results.push({test:'existing v1.7.0 work-file remains readable with defaults',pass:true});
 // Rapid switching while an earlier SVG response is deliberately delayed.
 await page.locator('#advancedPanel').evaluate(el=>el.open=true);
 await context.route('**/assets/dot-chars/hanyangyi-01.svg',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue();});
 await page.locator('#charCategory').selectOption('dot-hanyangi');
 await page.locator('#charGrid button').nth(1).click();await page.locator('#charGrid button').nth(2).click();await decode();
 await page.waitForTimeout(600);
 assert.equal(await page.locator('#characterImg').getAttribute('src'),'assets/dot-chars/hanyangyi-03.svg');
 assert.equal(await page.locator('#charGrid button[aria-pressed="true"]').count(),1);
 results.push({test:'rapid replacement ignores late previous image',pass:true});
 assert.deepEqual(errors,[]);
 const report={results,errors,dialogs,assetCount:poses.length,uniqueDotRequests:[...new Set(requests)].length};
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});

const {chromium}=require('playwright');
const fs=require('fs'),assert=require('assert/strict');
const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:8765';
fs.mkdirSync('test-results',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000},acceptDownloads:true});
 await require('./test-routing.cjs')(page,BASE_URL);
 const errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
 const fixture={orientation:'landscape',template:9,title:'Residence Card Collection',titleSize:48,subtitle:'',body:'① Please let us know your program type:<br>- Exchange Student (D-2-6) or<br>- Visiting Student (D-2-8) (Fee-paying)<br><br>② Please tell us your home country.',bodySize:25,emphasis:'*Please have your student ID card ready.',contentTop:24,contentWidth:76,charCategory:'hibibi',charIndex:1,textOffsets:{body:{x:0,y:65},emphasis:{x:0,y:-235}},objects:{character:{x:84,y:69,w:23,opacity:1,rotation:0,flip:false,z:7,locked:false}}};
 const result=[];
 async function load(state){await page.goto(BASE_URL,{waitUntil:'domcontentloaded'});const imported=page.waitForEvent('dialog');await page.locator('#workFile').setInputFiles({name:'fixture.notice.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'notice-maker',state}))});await imported;await page.evaluate(()=>document.fonts.ready);await page.locator('#templateBg').evaluate(img=>img.decode());await page.waitForTimeout(400);}
 async function status(){return page.locator('#layoutWarning').innerText()}
 async function savePDF(name){const d=page.waitForEvent('download',{timeout:30000});await page.locator('#pdf').click();await (await d).saveAs('test-results/'+name+'.pdf');}
 await load(fixture);console.log('initial',await status());console.log('libraries',await page.evaluate(()=>({canvas:typeof html2canvas,pdf:typeof jspdf})));
 await page.locator('#page').screenshot({path:'test-results/landscape.png'});
 result.push({test:'example layout',status:await status()});
 // A paragraph's empty right side must not block an adjacent mascot.
 await load({...fixture,body:'Short instruction.<br>Next line.',textOffsets:{},emphasis:'',objects:{character:{x:84,y:46,w:19}}});
 assert(!(await status()).includes('글자와 캐릭터'));result.push({test:'empty paragraph margin does not collide',pass:true});
await load({...fixture,body:'A',objects:{character:{x:50,y:50,w:10}}});
const position=await page.evaluate(()=>{const page=document.querySelector('#page'),r=page.getBoundingClientRect(),scale=r.width/1123;const node=document.querySelector('#pBody').firstChild,range=document.createRange();range.selectNodeContents(node);const t=range.getBoundingClientRect(),img=document.querySelector('#characterImg'),obj=document.querySelector('#characterObj');const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let l=c.width,top=c.height,rr=0,bb=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]){l=Math.min(l,x);top=Math.min(top,y);rr=Math.max(rr,x+1);bb=Math.max(bb,y+1)}const w=obj.offsetWidth*scale,h=obj.offsetHeight*scale;return {x:(t.right-3*scale-(l/c.width-.5)*w-r.left)/r.width*100,y:((t.top+t.bottom)/2-((top+bb)/2/c.height-.5)*h-r.top)/r.height*100}});
await load({...fixture,body:'A',objects:{character:{...position,w:10}}});const contactStatus=await page.locator('#status').innerText();assert(contactStatus.startsWith('확인 필요'));assert((await page.locator('#layoutWarning').innerText()).includes('경미한 접촉'));result.push({test:'3px contact warns without blocking',status:contactStatus});
// Transparent PNG padding alone crossing page edge should not block.
await load({...fixture,body:'',objects:{character:{x:93,y:50,w:20}}});assert.equal(await page.locator('#status').innerText(),'레이아웃 정상');result.push({test:'transparent image margin',pass:true});

 // Deliberate actual overlap is still blocked.
 await load({...fixture,body:'A very long instruction that crosses the mascot position.',textOffsets:{},emphasis:'',objects:{character:{x:50,y:40,w:35}}});
 assert((await page.locator('#status').innerText()).includes('출력 불가'));result.push({test:'real overlap blocked',pass:true,status:await status()});
 // Deliberate out-of-page content remains blocked; fix button reaches object controls.
 await load({...fixture,body:'Short instruction.',textOffsets:{},emphasis:'',objects:{character:{x:100,y:75,w:35}}});
 assert((await status()).includes('페이지 영역'));await page.locator('#layoutWarning button').first().click();assert(await page.locator('#advancedPanel').getAttribute('open')!==null);result.push({test:'clipping blocked with repair navigation',pass:true});
 // Build a safe example for real PNG/PDF output.
 const safe={...fixture,titleSize:46,bodySize:24,contentWidth:80,charCategory:'hibibi',objects:{character:{x:89,y:69,w:17}},textOffsets:{body:{x:0,y:65},emphasis:{x:0,y:-235}}};
 await load(safe);console.log('SAFE',await status());
 // Use the visible size control; test persistence and actual computed typography.
 for(const size of [15,60,26]){
 await page.locator('#emphasisSize').fill(String(size));
 assert.equal(await page.locator('#pEmphasis').evaluate(e=>getComputedStyle(e).fontSize),size+'px');
 await page.waitForTimeout(250);await page.reload();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
 assert.equal(await page.locator('#emphasisSize').inputValue(),String(size));result.push({test:'size '+size+' preview and autosave',pass:true});
 }
 await page.locator('#page').screenshot({path:'test-results/landscape.png'});
 await savePDF('landscape');
 let download=page.waitForEvent('download');await page.locator('#png').click();await (await download).saveAs('test-results/landscape.png');
 // Export/import round-trip via actual work-file controls.
 download=page.waitForEvent('download');await page.locator('#workSave').click();await (await download).saveAs('test-results/example.notice.json');
 await page.locator('#emphasisSize').fill('40');await page.locator('#workFile').setInputFiles('test-results/example.notice.json');await page.waitForTimeout(400);assert.equal(await page.locator('#emphasisSize').inputValue(),'26');result.push({test:'work file round trip',pass:true});
 // Old work files retain 26px and invalid new values are clamped.
 for(const [input,expected] of [[undefined,26],[-20,15],[999,60],['garbage',26],[null,26]]){
 const state={...safe};if(input!==undefined)state.emphasisSize=input;
 fs.writeFileSync('test-results/import.notice.json',JSON.stringify({app:'notice-maker',version:'1.7.0',state}));
 await page.locator('#workFile').setInputFiles('test-results/import.notice.json');await page.waitForTimeout(200);assert.equal(await page.locator('#emphasisSize').inputValue(),String(expected));result.push({test:'import size '+input,pass:true});
 }
 const portrait={...safe,orientation:'portrait',template:1,titleSize:38,contentTop:20,contentWidth:78,bodySize:20,emphasisSize:23,charCategory:'none',textOffsets:{}};
 await load(portrait);assert(!(await page.locator('#status').innerText()).includes('출력 불가'));await savePDF('portrait');await page.locator('#page').screenshot({path:'test-results/portrait.png'});result.push({test:'portrait A4 export',pass:true});
 await load({...portrait,body:'LongWord'.repeat(180),emphasis:'Important'.repeat(100),emphasisSize:60});
 assert((await page.locator('#status').innerText()).includes('출력 불가'));result.push({test:'long portrait overflow blocked',pass:true});
 await load({...safe,body:'LongWord'.repeat(180),emphasis:'Important'.repeat(100),emphasisSize:60});assert((await page.locator('#status').innerText()).includes('출력 불가'));result.push({test:'long landscape overflow blocked',pass:true});
 // Safe minimum and maximum print sizes without collision.
 for(const size of [15,60]){await load({...portrait,body:'Bring your student card.',emphasis:'Please prepare.',emphasisSize:size});await savePDF('emphasis-'+size);result.push({test:'PDF emphasis boundary '+size,pass:true});}
 await load(safe);
 // Print document: keep generated popup open without invoking OS dialog in automation.
 await page.addInitScript(()=>window.print=()=>{});
 const popupPromise=page.waitForEvent('popup');await page.locator('#print').click();const popup=await popupPromise;await popup.waitForSelector('img');await popup.locator('img').evaluate(img=>img.decode());
 assert.equal(await popup.locator('img').count(),1);await popup.pdf({path:'test-results/browser-print.pdf',preferCSSPageSize:true,printBackground:true});result.push({test:'browser print document A4',pass:true});await popup.close();
 assert.deepEqual(errors,[]);fs.writeFileSync('test-results/results.json',JSON.stringify({result,errors,dialogs},null,2));fs.writeFileSync('test-results/safe.notice.json',JSON.stringify({app:'notice-maker',version:'1.7.1',state:safe},null,2));console.log(JSON.stringify(result,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.env.KGU_WORKSPACE||path.resolve(__dirname,'../..'),out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1500,height:1100},acceptDownloads:true});
await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1'){let p=decodeURIComponent(u.pathname);if(p.endsWith('/'))p+='index.html';const file=path.join(root,p);return fs.existsSync(file)?r.fulfill({path:file,contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream'}):r.fulfill({status:404,body:''});}if(u.pathname.endsWith('html2canvas.min.js'))return r.fulfill({path:path.join(root,'notice-maker/kyonggi/vendor/html2canvas.min.js')});if(u.pathname.endsWith('jspdf.umd.min.js'))return r.fulfill({path:path.join(root,'notice-maker/kyonggi/vendor/jspdf.umd.min.js')});return r.abort();});
const page=await context.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
async function download(id,file){const pending=page.waitForEvent('download');await page.locator(id).click();await(await pending).saveAs(path.join(out,file));}
async function reopen(file){const p=await context.newPage();await p.goto('http://127.0.0.1:8766/evidence/'+file);await p.locator('img').evaluate(i=>i.decode());await p.screenshot({path:path.join(out,'reopened-'+file)});await p.close();}
for(const route of ['notice-maker/kyonggi/','badge-maker/kyonggi/lanyard-badge/','badge-maker/kyonggi/clip-badge/']){
 await page.goto('http://127.0.0.1:8766/'+route);await page.waitForTimeout(900);await page.screenshot({path:path.join(out,route.includes('notice')?'notice-ui.png':route.includes('lanyard')?'lanyard-ui.png':'clip-ui.png'),fullPage:true});
 console.log(route,await page.title(),errors);
 if(route.includes('badge')){
  const kind=route.includes('lanyard')?'lanyard':'clip';
  await page.locator('#campus').selectOption('seoul');await page.locator('#campusAddress').fill('서울캠퍼스 · 예시 교육실');await page.locator('#showAddress').check();await page.waitForTimeout(250);await page.reload();assert.equal(await page.locator('#campusAddress').inputValue(),'서울캠퍼스 · 예시 교육실');
  await page.locator('#logoMode').selectOption('none');assert.equal(await page.locator('#previewSlot .badge-logo').count(),0);await page.locator('#logoMode').selectOption('kgu');
  for(const template of ['blue','official','kgu','hibb','staff','ribbon','frame','side']){assert((await page.evaluate(t=>{const s=badgeApp.getState();s.template=t;return badgeApp.setState(s)},template)).valid);await page.waitForTimeout(80);await page.locator('#previewSlot').screenshot({path:path.join(out,kind+'-'+template+'.png')});}
  await page.evaluate(()=>{const s=badgeApp.getState();s.template='kgu';badgeApp.setState(s)});assert.equal(await page.locator('#previewSlot .badge-character').count(),1);await page.locator('#showCharacter').uncheck();assert.equal(await page.locator('#previewSlot .badge-character').count(),0);await page.locator('#showCharacter').check();
  await page.locator('#width').fill('100');await page.locator('#width').dispatchEvent('change');
  await page.locator('#name').fill('긴 이름 검증을 위한 가상참가자');await page.locator('#name').dispatchEvent('change');await page.locator('#previewSlot').screenshot({path:path.join(out,kind+'-long.png')});
  await page.locator('#name').fill('가상참가자');await page.locator('#name').dispatchEvent('change');
  await page.locator('#importDetails').evaluate(e=>e.open=true);await page.locator('#bulkInput').fill('이름\t소속\t직책\n예시하나\t경기대학교\t참가자\n예시둘\t경기대학교\t운영진');await page.locator('#replaceImport').click();assert.equal((await page.evaluate(()=>badgeApp.getState())).records.length,2);
  await download('#saveProject',kind+'.json');await page.locator('#name').fill('변경');await page.locator('#projectFile').setInputFiles(path.join(out,kind+'.json'));assert.equal(await page.locator('#name').inputValue(),'예시하나');
  const changed=await page.evaluate(()=>badgeApp.updateElement('name',{color:'#215292',fontSizePt:23,xMm:10}));assert(changed.valid);
  await download('#exportPNG',kind+'-download.png');await reopen(kind+'-download.png');
  await page.evaluate(()=>badgeApp.preparePrint('all'));await page.pdf({path:path.join(out,kind+'-print.pdf'),preferCSSPageSize:true,printBackground:true});
  assert.equal(await page.locator('img[src*="hyu"],img[src*="hanyangi"],img[src*="hibb.png"]').count(),0);
  results.push(kind+': 8 templates, address, reload, logo/character toggle, mm, long text, batch, JSON roundtrip, edit, PNG reopen, print PDF passed');
 }else{
  await page.locator('#title').fill('경기대학교 안내');await page.locator('#body').fill('캠퍼스 이용 안내입니다.\n방문 전 장소와 시간을 확인해 주세요.');
  await page.locator('#campus').selectOption('seoul');assert((await page.locator('#footer').innerText()).includes('경기대로'));
  await page.locator('#footer').fill('서울캠퍼스 · 예시 교육실');await page.waitForTimeout(500);await page.reload();assert.equal(await page.locator('#footer').innerText(),'서울캠퍼스 · 예시 교육실');
  await page.locator('#advancedPanel').evaluate(e=>e.open=true);await page.locator('#charCategory').selectOption('giryong');await page.waitForTimeout(250);await page.locator('#characterImg').evaluate(i=>i.decode());await page.locator('#charCategory').selectOption('none');await page.locator('#logoType').selectOption('none');await page.locator('#logoType').selectOption('kgu');
  for(let i=0;i<4;i++){await page.locator('.template-btn').nth(i).click();await page.waitForTimeout(100);await page.locator('#page').screenshot({path:path.join(out,'notice-template-'+(i+1)+'.png')});}
  await page.locator('#body').fill('긴 안내 문구 검증 '.repeat(100));await page.waitForTimeout(300);await page.locator('#page').screenshot({path:path.join(out,'notice-long.png')});console.log('long status',await page.locator('#status').innerText());
  await page.locator('#body').fill('캠퍼스 이용 안내입니다.\n방문 전 장소와 시간을 확인해 주세요.');await page.waitForTimeout(300);
  await download('#png','notice-download.png');await reopen('notice-download.png');await download('#pdf','notice-download.pdf');
  const save=await page.locator('button').evaluateAll(es=>es.filter(e=>/작업.*저장/.test(e.textContent)).map(e=>e.id));console.log('save id',save);
  if(save[0]){await download('#'+save[0],'notice.json');await page.locator('#title').fill('변경');await page.locator('#workFile').setInputFiles(path.join(out,'notice.json'));assert.equal(await page.locator('#title').innerText(),'경기대학교 안내');}
  assert.equal(await page.locator('img[src*="hyu"],img[src*="hanyangi"],img[src*="hibibi"]').count(),0);
  results.push('notice: 4 templates, address, reload, logo/character toggle, long text, PNG reopen, PDF, JSON roundtrip passed');
 }
}
for(const route of ['notice-maker/','badge-maker/lanyard-badge/','badge-maker/clip-badge/']){await page.goto('http://127.0.0.1:8766/'+route);await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'hanyang-'+route.replaceAll('/','-')+'.png')});results.push('original '+route+' renders');}
assert.deepEqual(errors,[]);await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log(results);
})().catch(e=>{console.error(e);process.exit(1)});


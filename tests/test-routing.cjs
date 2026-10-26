const fs=require('fs'),path=require('path');
// Optional deterministic local run: keep the real HTTP origin and browser
// storage while serving approved local files through Playwright interception.
module.exports=async(target,base)=>{
 await target.route(/googletagmanager\.com|google-analytics\.com/,route=>route.abort());
 if(process.env.TEST_LOCAL_FILES!=='1')return;
 const root=path.resolve(__dirname,'..'),origin=new URL(base).origin;
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
 await target.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(/googletagmanager\.com|google-analytics\.com/.test(url.hostname))return route.abort();
  if(request.resourceType()==='stylesheet'||request.resourceType()==='font')return route.abort();
  if(url.origin===origin){
   const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
  }
  for(const name of ['html2canvas.min.js','jspdf.umd.min.js']){
   if(url.pathname.endsWith('/'+name))return route.fulfill({path:path.join(root,'test-results','vendor',name),contentType:'text/javascript'});
  }
  return route.abort();
 });
};

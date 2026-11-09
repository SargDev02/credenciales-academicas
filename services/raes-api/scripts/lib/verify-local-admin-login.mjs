import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
export async function verifyLocalAdminLogin({ email,password,accessToken,profile,revokeSession }) {
 const api='http://localhost:3001',web='http://localhost:3000';
 const response=await fetch(api+'/api/v1/admin/me',{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.id,profile.id);assert.equal(body.data.rol,profile.rol);assert.equal(body.data.estado,'ACTIVO');
 const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const browser=await chromium.launch({headless:true,...(existsSync(chrome)?{executablePath:chrome}:{})});
 const context=await browser.newContext(),page=await context.newPage();let loggedOut=false,browserToken;
 try{
  await page.goto(web+'/login');await page.getByLabel('Correo institucional',{exact:true}).fill(email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
  await page.waitForURL(web+'/dashboard');
  await page.getByRole('heading',{name:'Resumen del registro',exact:true}).waitFor();
  const cookies=(await context.cookies()).filter(c=>c.name.startsWith('raes-web-auth'));
  assert.ok(cookies.length>0&&cookies.every(c=>c.httpOnly&&c.sameSite==='Lax'));
  const raw=cookies.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(c=>c.value).join('');
  if(raw){const value=JSON.parse(raw.startsWith('base64-')?Buffer.from(raw.slice(7),'base64url').toString():raw);browserToken=value.access_token;}
  await page.getByRole('button',{name:'Salir',exact:true}).click();await page.waitForURL(web+'/login');loggedOut=true;
  assert.ok(!(await context.cookies()).some(c=>c.name.startsWith('raes-web-auth')));
  await page.goto(web+'/dashboard');await page.waitForURL(web+'/login');
  const evidence={verifiedAt:new Date().toISOString(),profileId:profile.id,role:profile.rol,state:profile.estado,adminMeHttp:200,browserLogin:'PASS',httpOnlyCookies:true,logoutGuard:'PASS'};
  writeFileSync('/tmp/raes-admin-reconnection-result.json',JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(evidence));
 }finally{
  if(!browserToken){const cookies=(await context.cookies()).filter(c=>c.name.startsWith('raes-web-auth'));const raw=cookies.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(c=>c.value).join('');if(raw){try{browserToken=JSON.parse(raw.startsWith('base64-')?Buffer.from(raw.slice(7),'base64url').toString():raw).access_token;}catch{}}}
  try{if(!loggedOut&&browserToken)await revokeSession(browserToken);}finally{await browser.close();}
 }
}

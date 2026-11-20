import {test,expect} from '@playwright/test';
import {startRecoveryFixture} from '../helpers/recovery-fixture.mjs';
let qa;
test.beforeAll(async()=>{qa=await startRecoveryFixture();});
test.afterAll(async()=>{await qa?.stop();});
test.afterEach(()=>{expect(qa.state.unexpected).toEqual([]);qa.state.expired=false;});
async function request(page,base,email,prefix=''){
 await page.goto(base+prefix+'/forgot-password');await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.getByRole('button',{name:'Solicitar enlace',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Si la cuenta puede recuperarse'})).toBeVisible();
}
for(const [product,prefix,userIndex]of [['raes','',0],['credenly','',1],['credenly','/admin',2]])test(`${product}${prefix} recovery exchanges PKCE only on POST, updates after own API authorization and logs out globally`,async({page})=>{
 const base=qa[product],before=qa.state.updates,exchanges=qa.state.exchanges,logouts=qa.state.globalLogouts;
 await request(page,base,qa.users[userIndex].email,prefix);const link=qa.state.lastLink;expect(link).toBeTruthy();
 const response=await page.goto(link);expect(response.headers()['cache-control']).toContain('no-store');expect(response.headers()['content-security-policy']).toContain("'nonce-");expect(qa.state.exchanges).toBe(exchanges);
 await page.getByRole('button',{name:'Continuar con recuperación',exact:true}).click();await expect(page).toHaveURL(base+prefix+'/reset-password');
 await page.getByLabel('Nueva contraseña',{exact:true}).fill('synthetic-new-password-for-local-tests');await page.getByLabel('Confirmar contraseña',{exact:true}).fill('synthetic-new-password-for-local-tests');await page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Contraseña actualizada'})).toBeVisible();expect(qa.state.updates).toBe(before+1);expect(qa.state.globalLogouts).toBe(logouts+1);
 const cookies=await page.context().cookies();expect(cookies.filter(c=>c.name.includes('recovery'))).toHaveLength(0);expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
});
test('unknown mailbox has the same acknowledgement and creates no user',async({page})=>{
 await request(page,qa.credenly,'unknown@fixture.invalid');expect(qa.state.lastLink).toBeNull();
});
test('invalid and expired links do not modify a password',async({page})=>{
 const before=qa.state.updates;
 for(const expired of [false,true]){
  let link=qa.raes+'/auth/recovery?code=invalid';
  if(expired){await request(page,qa.raes,qa.users[0].email);link=qa.state.lastLink;qa.state.expired=true;}
  await page.goto(link);await page.getByRole('button',{name:'Continuar con recuperación',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'enlace no está disponible'})).toBeVisible();
 }
 expect(qa.state.updates).toBe(before);
});
test('no signed recovery proof means no password update',async({page})=>{
 const before=qa.state.updates;await page.goto(qa.credenly+'/reset-password');await page.getByLabel('Nueva contraseña',{exact:true}).fill('synthetic-new-password-for-local-tests');await page.getByLabel('Confirmar contraseña',{exact:true}).fill('synthetic-new-password-for-local-tests');await page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'sesión de recuperación venció'})).toBeVisible();expect(qa.state.updates).toBe(before);
});
test('citizen cannot use administrative recovery to change a password',async({page})=>{
 const before=qa.state.updates;await request(page,qa.credenly,qa.users[1].email,'/admin');await page.goto(qa.state.lastLink);await page.getByRole('button',{name:'Continuar con recuperación',exact:true}).click();await expect(page).toHaveURL(qa.credenly+'/admin/reset-password');await page.getByLabel('Nueva contraseña',{exact:true}).fill('synthetic-new-password-for-local-tests');await page.getByLabel('Confirmar contraseña',{exact:true}).fill('synthetic-new-password-for-local-tests');await page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'No fue posible completar'})).toBeVisible();expect(qa.state.updates).toBe(before);
});
test('recovery form fits 360/768/1024/1440 and keeps labels and keyboard focus',async({page})=>{
 for(const width of [360,768,1024,1440]){await page.setViewportSize({width,height:1000});await page.goto(qa.raes+'/forgot-password');await page.getByLabel('Correo electrónico',{exact:true}).focus();await expect(page.getByLabel('Correo electrónico',{exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

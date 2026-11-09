import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {startReviewFixture} from '../helpers/academic-review-fixture.mjs';
import {ids} from '../../scripts/lib/academic-review-fixture.mjs';
let qa,lease;
test.beforeAll(async()=>{qa=await startReviewFixture();const res=await fetch(qa.raes+'/api/v1/academic-review/detections',{method:'POST',headers:{Authorization:qa.institutionAuthorization}});expect(res.status).toBe(200);lease=(await res.json()).data;});
test.afterAll(async()=>{await qa?.stop();});
test.afterEach(()=>{expect(qa.unexpected).toEqual([]);expect(qa.citizenWrites()).toBe(0);});
async function propose(title){const o=qa.observation();o.credenciales[0].contenido.titulo=title;const res=await fetch(qa.raes+'/api/v1/academic-review/proposals',{method:'POST',headers:{Authorization:qa.institutionAuthorization,'Content-Type':'application/json'},body:JSON.stringify({deteccionId:lease.id,observacion:o})});expect(res.status).toBe(200);return (await res.json()).data.observaciones.find(r=>r.nueva)?.id;}
async function citizen(){const res=await fetch(qa.credenly+'/api/v1/credentials',{headers:{Authorization:'Bearer '+qa.tokenFor(qa.citizenId)}});expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('private, no-store');const body=await res.json();expect(body.source).toBe('RAES');expect(body.persistedByCredenly).toBe(false);return body.data[0];}
async function login(page,auditor=false){await page.goto(qa.base+'/login');await page.getByLabel('Correo institucional',{exact:true}).fill(qa.users[auditor?1:0].email);await page.getByLabel('Contraseña',{exact:true}).fill(qa.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page).toHaveURL(qa.base+'/dashboard');}
async function api(id,action,actor=ids.admin,body={}){return fetch(`${qa.raes}/api/v1/admin/academic-reviews/${id}/${action}`,{method:'POST',headers:{Authorization:'Bearer '+qa.tokenFor(actor),'Content-Type':'application/json'},body:JSON.stringify(body)});}

test('HTTP proposal stays invisible to citizen until actual browser approval; next GET returns B and repeat approval does not duplicate',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.name));
 const first=await citizen();expect(first.version.titulo).toBe('Título sintético inicial');const id=await propose('Título sintético aprobado B');
 expect((await citizen()).version.titulo).toBe(first.version.titulo);await login(page);await page.getByRole('link',{name:'Validaciones',exact:true}).click();await page.getByRole('link',{name:'Revisar solicitud →'}).click();
 await expect(page.getByRole('region',{name:'Comparación académica'})).toContainText('Título sintético aprobado B');
 await page.getByRole('button',{name:'Aceptar',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Esta acción incorporará el cambio al registro oficial RAES.');await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 await page.getByRole('button',{name:'Aceptar',exact:true}).click();await dialog.getByRole('button',{name:'Sí, incorporar cambio'}).click();await expect(page.getByRole('status').filter({hasText:'Aprobada'})).toBeVisible();
 const second=await citizen();expect(second.id).toBe(first.id);expect(second.versionActual).toBe(2);expect(second.version.titulo).toBe('Título sintético aprobado B');
 const replay=await api(id,'approve');expect(replay.status).toBe(200);expect((await replay.json()).data.replayed).toBe(true);expect((await citizen()).versionActual).toBe(2);
 expect(qa.calls.filter(c=>c.realm==='raes'&&c.path==='/rest/v1/credenciales').length).toBeGreaterThanOrEqual(4);expect(errors).toEqual([]);
});
test('AUDITOR reads, has no decision controls, and backend returns 403 for approval',async({page})=>{
 const id=await propose('Cambio para revisión del auditor');await login(page,true);await page.goto(`${qa.base}/validations/${id}`);await expect(page.getByText('Tu rol AUDITOR permite consultar',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Aceptar',exact:true})).toHaveCount(0);expect((await api(id,'approve',ids.auditor)).status).toBe(403);
});
test('superseded requests cannot be approved; rejection requires reason and leaves citizen version intact',async({page})=>{
 const old=await propose('Contenido anterior supersedido'),id=await propose('Contenido posterior para rechazar');expect((await api(old,'approve')).status).toBe(409);
 await login(page);await page.goto(`${qa.base}/validations/${old}`);await expect(page.getByText('Solicitud supersedida',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Aceptar',exact:true})).toHaveCount(0);
 await page.goto(`${qa.base}/validations/${id}`);await page.getByRole('button',{name:'Rechazar',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Confirmar rechazo'}).click();await expect(dialog).toBeVisible();await dialog.getByLabel('Motivo del rechazo').fill('Contenido sintético rechazado en prueba');await dialog.getByRole('button',{name:'Confirmar rechazo'}).click();await expect(page.getByRole('status').filter({hasText:'Rechazada'})).toBeVisible();expect((await citizen()).version.titulo).toBe('Título sintético aprobado B');
});
test('responsive filters, comparison keyboard region and decision dialogs at 360/768/1024/1440',async({page})=>{
 const id=await propose('Propuesta sintética para revisión responsive');await login(page);await mkdir('/tmp/academic-review-browser',{recursive:true});
 for(const width of [360,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(qa.base+'/validations');await page.getByRole('button',{name:'Aplicar filtros'}).click();await expect(page.getByRole('heading',{name:'Validaciones',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto(`${qa.base}/validations/${id}`);const region=page.getByRole('region',{name:'Comparación académica'});await region.focus();await expect(region).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`/tmp/academic-review-browser/detail-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Rechazar',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 }
});
test('private credential errors also prevent caching',async()=>{
 for(const url of [qa.credenly+'/api/v1/credentials',qa.raes+'/api/v1/persons/'+ids.admin+'/credentials']){const response=await fetch(url);expect(response.status).toBe(401);expect(response.headers.get('cache-control')).toBe('private, no-store');}
});
test('invalid filters, empty and missing states are explicit',async({page})=>{
 await login(page);await page.goto(qa.base+'/validations?pageSize=101');await expect(page.getByRole('alert').filter({hasText:'Filtros no válidos'})).toBeVisible();await page.goto(qa.base+'/validations?q=NO-SUCH-SYNTHETIC-CODE');await expect(page.getByText('Sin solicitudes para estos filtros',{exact:true})).toBeVisible();await page.goto(qa.base+'/validations/00000000-0000-4000-8000-999999999999');await expect(page.getByRole('heading',{name:'Solicitud no disponible'})).toBeVisible();
});

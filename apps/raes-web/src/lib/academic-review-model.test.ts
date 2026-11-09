import assert from 'node:assert/strict';
import test from 'node:test';
import {compareAcademicData,fieldLabel,reviewTone} from './academic-review-model';
test('comparison highlights changed leaves while keeping equal and missing values explicit',()=>{
 const rows=compareAcademicData({contenido:{titulo:'A',descripcion:null},estado:'VIGENTE'},{contenido:{titulo:'B',descripcion:null},estado:'REVOCADA'});
 assert.equal(rows.find(r=>r.path==='contenido.titulo')?.changed,true);
 assert.equal(rows.find(r=>r.path==='contenido.descripcion')?.changed,false);
 assert.equal(rows.find(r=>r.path==='contenido.descripcion')?.actual,'Sin dato');
 assert.equal(rows.find(r=>r.path==='estado')?.proposed,'REVOCADA');
});
test('new student group renders person and all credentials; timestamps and internal source keys are excluded',()=>{
 const rows=compareAcademicData({},{persona:{primerNombre:'Sintética',identificadorOrigen:'internal'},credenciales:[{contenido:{titulo:'Diploma'}}],sourceUpdatedAt:'internal'});
 assert.equal(rows[0]?.path,'persona.primerNombre');assert.ok(rows.some(r=>r.label==='Credencial 1 · Credencial · Título'));assert.ok(rows.every(r=>r.proposed!=='internal'));
});
test('review status labels are accompanied by distinct semantic tones',()=>{assert.equal(reviewTone('PENDIENTE'),'warning');assert.equal(reviewTone('RECHAZADA'),'danger');assert.equal(reviewTone('APROBADA'),'success');assert.equal(fieldLabel('programa.nombre'),'Programa · Nombre');});

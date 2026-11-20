import test from 'node:test';import assert from 'node:assert/strict';
import {createInstitutionSourceClient,readInstitutionalSnapshot} from './source';
test('institutional snapshots fail before proposals on excess rows and reject invalid budgets',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async input=>{calls++;const table=new URL(String(input)).pathname.split('/').at(-1);return Response.json(table==='institucion'?[{nit:'SYNTHETIC',nombre:'Synthetic',tipo_institucion:'UNIVERSIDAD',estado:'ACTIVA',codigo_snies:null}]:table==='estudiantes'?[{id:'synthetic-1'},{id:'synthetic-2'}]:[]);};
 const db=createInstitutionSourceClient({supabaseUrl:'https://institution.fixture.invalid',serviceRoleKey:'synthetic-read-key'});
 try{await assert.rejects(readInstitutionalSnapshot(db,0),/Límite/);assert.equal(calls,0);await assert.rejects(readInstitutionalSnapshot(db,1),/límite seguro/);}finally{globalThis.fetch=original;}
});

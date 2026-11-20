import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('production start overrides test mode and refuses an unconfigured process before Next or database access',()=>{
 const result=spawnSync('pnpm',['--filter','@raes/web','start'],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,HOME:process.env.HOME,APP_ENV:'test',CI:'true'}});
 assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/EXPOSURE_SCOPE/);assert.ok(!(result.stdout+result.stderr).includes('Ready in'));
});

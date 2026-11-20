import { deploymentMode } from './deployment';
type Environment=Record<string,string|undefined>;
export function pilotUserAllowed(userId:string,env:Environment=process.env):boolean {
 if(deploymentMode(env)!=='production')return true;
 return env.EXPOSURE_SCOPE==='closed-synthetic-pilot'&&(env.PILOT_ALLOWED_USER_IDS??'').split(',').some(id=>id.trim().toLowerCase()===userId.toLowerCase());
}
export function pilotEmailAllowed(email:string,env:Environment=process.env):boolean {
 if(deploymentMode(env)!=='production')return true;
 return env.EXPOSURE_SCOPE==='closed-synthetic-pilot'&&(env.PILOT_ALLOWED_EMAILS??'').split(',').some(value=>value.trim().toLowerCase()===email.trim().toLowerCase());
}

export function selfRegistrationAllowed(env:Environment=process.env):boolean { return deploymentMode(env)!=='production'; }

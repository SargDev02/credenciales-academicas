import {chromium} from '@playwright/test';

// Entirely synthetic document, rendered in memory for the operator's local OCR.
export async function renderSyntheticReviewDocument(document,{font='Arial',size=64}={}) {
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  const page=await browser.newPage({viewport:{width:2200,height:800},deviceScaleFactor:1});
  await page.setContent('<body style="margin:0"><canvas width="2200" height="800"></canvas>');
  await page.evaluate(({document,font,size})=>{
   const ctx=globalThis.document.querySelector('canvas').getContext('2d');
   ctx.fillStyle='white';ctx.fillRect(0,0,2200,800);ctx.fillStyle='black';ctx.font=`${size}px ${font}`;
   ['PRUEBA SINTETICA - SIN VALIDEZ','CEDULA DE CIUDADANIA','DOCUMENTO: '+document,'NOMBRES: SINTETICA','APELLIDOS: REVISION'].forEach((line,i)=>ctx.fillText(line,70,120+i*125));
  },{document,font,size});
  return await page.locator('canvas').screenshot();
 } finally {await browser.close();}
}

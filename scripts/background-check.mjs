import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',args:[]});
const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5177/experience.html');
await page.waitForSelector('.xp.is-interactive',{timeout:60000});
for(const [name,u] of [['home',0],['strand',2.05],['golf',6],['snow',14.1],['evidence',16.1],['glasses',19.6],['flywheel',23.5],['field',27.5]]){
 await page.evaluate(v=>scrollTo(0,v*innerHeight),u);
 await page.waitForTimeout(1800);
 await page.screenshot({timeout:90000,path:`/tmp/cerebel-clean-${name}.png`});
 console.log(name);
}
await page.evaluate(()=>scrollTo(0,6*innerHeight));await page.waitForTimeout(1200);
await page.locator('.muscle-entry').click();await page.waitForTimeout(1600);
await page.screenshot({timeout:90000,path:'/tmp/cerebel-clean-anatomy.png'});
await page.locator('.muscle-orbit nav button').last().click();
await page.keyboard.press('Escape');
if(await page.locator('dialog').evaluate(d=>d.open))throw Error('Escape failed');
if(errors.length)throw Error(errors.join('\n'));
console.log('PASS: seven scenes, anatomy switch and close; no page errors.');
await browser.close();

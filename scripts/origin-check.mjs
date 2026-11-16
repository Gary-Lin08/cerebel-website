import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.argv[2] || 'http://localhost:5177/experience.html');await page.waitForSelector('.xp.is-live',{timeout:60000});
for(const [name,u] of [['opening',0],['cerebellum',1.2],['release',1.7],['strand',2.35]]){
 await page.evaluate(u=>scrollTo(0,u*innerHeight),u);await page.waitForTimeout(1200);await page.screenshot({path:`/tmp/cerebel-origin-${name}.png`});
}
if(errors.length)throw Error(errors.join('\n'));console.log('Origin camera sequence rendered without page errors.');await browser.close();

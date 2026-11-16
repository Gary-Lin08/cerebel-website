import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5177/experience.html');
 await page.waitForSelector('.xp.is-interactive',{timeout:60000});
 const box=await page.locator('.ch.is-on .ln > span').first().boundingBox();
 await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);
 await page.waitForFunction(()=>document.querySelector('[data-lens-target="1"]'));
 await page.evaluate(()=>scrollTo(0,6*innerHeight));
 await page.waitForFunction(()=>document.querySelector('.xp').dataset.act==='1');
 await page.waitForFunction(()=>document.querySelectorAll('[data-lens]').length===0,null,{timeout:30000});
 await page.waitForTimeout(4000);
 const pixels=await page.locator('.xp-lens').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4)if(a[i]>8)n++;return n;});
 if(pixels>10)throw Error(`Stationary cursor left ${pixels} visible overlay pixels`);
 await page.screenshot({path:'/tmp/cerebel-hover-fixed.png',timeout:90000});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: stationary cursor clears old heading lens and particle overlay on scroll.');
} finally {await browser.close();}

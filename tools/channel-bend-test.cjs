const { chromium } = require(process.env.PW_PATH || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', args:['--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl'] });
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2]);
    const pixels=async()=>{
      await page.waitForFunction(()=>window.__done===true);
      return page.locator('#cv').evaluate(canvas=>canvas.toDataURL());
    };
    const bend=page.locator('#channelBend');
    await pixels();
    await bend.fill('0');
    const straight=await pixels();
    await page.locator('#cv').screenshot({path:'shots/river-straight.png'});
    const map=page.locator('#channelMap');
    await map.scrollIntoViewIfNeeded();
    const box=await map.boundingBox();
    await page.mouse.move(box.x+box.width*.43,box.y+box.height*.5);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.58,box.y+box.height*.52,{steps:5});
    await page.mouse.up();
    const bent=await pixels();
    assert.ok(Number(await bend.inputValue())>.35);
    assert.ok(straight!==bent);
    await page.locator('#cv').screenshot({path:'shots/river-bent.png'});
    await page.reload();
    assert.ok(await pixels()===bent);
    await bend.fill('0');
    assert.ok(await pixels()===straight);
    assert.deepEqual(errors,[]);
    console.log('Map drag changes land, link restores bend, and zero bend exactly restores straight terrain.');
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });

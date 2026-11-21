const { chromium } = require(process.env.PW_PATH || 'playwright');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl'] });
  try {
    const page = await browser.newPage({ viewport: {width:1280,height:900} });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.argv[2]);
    await page.getByText('Crag Lagoon',{exact:true}).click();
    const pixels = async () => {
      await page.waitForFunction(() => window.__done === true);
      return page.locator('#cv').evaluate(c => c.toDataURL());
    };
    mkdirSync('shots',{recursive:true});
    const original = await pixels();
    await page.locator('#cv').screenshot({path:'shots/channel-before.png'});
    await page.getByRole('button',{name:'Carve a channel'}).click();
    assert.notEqual(await pixels(),original);
    for(const [id,value] of [['channelOffset',.07],['channelAngle',24],['channelWidth',.34]]){
      await page.locator('#'+id).fill(String(value));
      await pixels();
    }
    const cut = await pixels();
    await page.locator('#cv').screenshot({path:'shots/channel-after.png'});
    await page.reload();
    assert.equal(await pixels(),cut);
    await page.getByRole('button',{name:'Fill channel'}).click();
    assert.equal(await pixels(),original);
    assert.deepEqual(errors,[]);
    console.log('Carve, three controls, share reload and exact fill restoration passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

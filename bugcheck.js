const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const bugs = [];
  
  page.on('pageerror', error => {
    bugs.push({ sev: 'critical', cat: 'error', msg: error.message });
  });

  // Твоя игра
  await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'networkidle2', timeout: 60000 });
  
  await page.evaluate(() => {
    window.__CLOUD_BUGS__ = [];
    window.addEventListener('error', function(e) {
      window.__CLOUD_BUGS__.push({ sev: 'critical', cat: 'error', msg: e.message });
    });
    
    // Бот делает пакости в игре
    setInterval(() => {
      try {
        if (typeof strikeBolt === 'function' && Math.random() > 0.5) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
        if (typeof makeBeing === 'function' && Math.random() > 0.7) makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, 'traitor', false, null);
      } catch(e) {}
    }, 1000);
  });

  // Ждем 3 минуты, пока робот играет
  await new Promise(r => setTimeout(r, 180000)); 

  const foundBugs = await page.evaluate(() => window.__CLOUD_BUGS__);
  fs.writeFileSync('bugs.json', JSON.stringify([...bugs, ...foundBugs], null, 2));

  await browser.close();
})();

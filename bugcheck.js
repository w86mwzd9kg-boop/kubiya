const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Ловим вылеты самой игры
    page.on('pageerror', error => {
      bugs.push({ sev: 'critical', cat: 'error', msg: error.message });
    });

    console.log('Открываем игру...');
    // Ждем только загрузку текста (так быстрее и надежнее)
    const response = await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const html = await response.text();

    console.log('Ищем баги в коде...');
    if (/if\s*\(\s*a\.isExposed\s*\)/.test(html)) {
      bugs.push({ sev: 'critical', cat: 'static', msg: 'hostile(): проверяется a.isExposed вместо b.isExposed' });
    }
    if (/mode\s*===\s*['"]divine['"]\s*\?\s*999/.test(html)) {
      bugs.push({ sev: 'warning', cat: 'static', msg: 'Урон Кары (999) не убивает медведя на "Безумии"' });
    }

    // СРАЗУ сохраняем статические баги, чтобы они не потерялись
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));

    console.log('Запускаем игру и включаем проверки...');
    await page.evaluate(() => {
      window.__CLOUD_BUGS__ = [];
      // Пытаемся запустить игру (нажимаем "Создать мир")
      try {
         if (typeof appState !== 'undefined' && appState === 'settings') {
             if (typeof showKingdomPick === 'function') showKingdomPick('medium');
         }
      } catch(e) {}

      // Бот делает пакости
      setInterval(() => {
        try {
          if (typeof strikeBolt === 'function' && Math.random() > 0.4) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
          if (typeof makeBeing === 'function' && Math.random() > 0.6) makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, 'traitor', false, null);
        } catch(e) {}
      }, 800);

      // Глубокие проверки
      setInterval(() => {
        try {
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            var nanCount = 0, deadCount = 0;
            for (var i = 0; i < beings.length; i++) {
              var u = beings[i];
              if (!u) continue;
              if (u.hp <= 0) deadCount++;
              if (!isFinite(u.x) || !isFinite(u.y)) nanCount++;
            }
            if (deadCount > 0) window.__CLOUD_BUGS__.push({ sev: 'warning', cat: 'logic', msg: 'Найдено ' + deadCount + ' мертвых существ' });
            if (nanCount > 0) window.__CLOUD_BUGS__.push({ sev: 'critical', cat: 'state', msg: 'Найдено ' + nanCount + ' существ с NaN координатами' });
          }
        } catch(e) {}
      }, 2000);
    });

    console.log('Играем 5 минут...');
    await new Promise(r => setTimeout(r, 300000)); 

    console.log('Сохраняем результат...');
    const foundBugs = await page.evaluate(() => window.__CLOUD_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    // Если робот упал, записываем саму ошибку в файл, чтобы ты ее увидел
    bugs.push({ sev: 'critical', cat: 'robot', msg: 'Ошибка робота: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

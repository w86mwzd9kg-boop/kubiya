const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const bugs = [];

  // 1. Ловим критические вылеты
  page.on('pageerror', error => {
    bugs.push({ sev: 'critical', cat: 'error', msg: error.message });
  });

  console.log('1. Проверяем текст кода игры...');
  const gameUrl = 'https://w86mwzd9kg-boop.github.io/kubiya/';
  const response = await page.goto(gameUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  const html = await response.text();

  // Статический анализ (поиск багов в самом коде)
  if (/if\s*\(\s*a\.isExposed\s*\)/.test(html)) {
    bugs.push({ sev: 'critical', cat: 'static', msg: 'hostile(): проверяется a.isExposed вместо b.isExposed — предателей нельзя убить' });
  }
  if (/mode\s*===\s*['"]divine['"]\s*\?\s*999/.test(html)) {
    bugs.push({ sev: 'warning', cat: 'static', msg: 'Урон Кары (999) не убивает медведя на "Безумии"' });
  }

  // 2. Запускаем игру и включаем глубокий анализ
  console.log('2. Запускаем игру и ждем 5 минут...');
  await page.evaluate(() => {
    window.__CLOUD_BUGS__ = [];
    
    // Автоматически запускаем игру, если она в меню
    if (typeof appState !== 'undefined' && appState === 'settings') {
        if (typeof generateWorld === 'function') {
            generateWorld();
            createKingdoms();
            appState = 'playing';
        }
    }

    // Робот делает пакости (молнии, предатели, медведи)
    setInterval(() => {
      try {
        if (typeof strikeBolt === 'function' && Math.random() > 0.4) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.random() > 0.5 ? 'divine' : 'normal');
        if (typeof makeBeing === 'function' && Math.random() > 0.6) makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.random() > 0.5 ? 'traitor' : 'beast', false, null);
        if (typeof spawnBearRaid === 'function' && Math.random() > 0.8) spawnBearRaid();
      } catch(e) {}
    }, 800);

    // Глубокие проверки каждые 2 секунды
    setInterval(() => {
      try {
        // Проверка существ
        if (typeof beings !== 'undefined' && Array.isArray(beings)) {
          var nanCount = 0, deadCount = 0, stuckCount = 0;
          for (var i = 0; i < beings.length; i++) {
            var u = beings[i];
            if (!u) continue;
            if (u.hp <= 0) deadCount++;
            if (!isFinite(u.x) || !isFinite(u.y)) nanCount++;
            if (typeof walkable === 'function' && typeof u.swimming !== 'undefined') {
              if (!u.swimming && !walkable(u.x, u.y)) stuckCount++;
            }
          }
          if (deadCount > 0) window.__CLOUD_BUGS__.push({ sev: 'warning', cat: 'logic', msg: 'Найдено ' + deadCount + ' мертвых существ (HP <= 0)' });
          if (nanCount > 0) window.__CLOUD_BUGS__.push({ sev: 'critical', cat: 'state', msg: 'Найдено ' + nanCount + ' существ с NaN координатами' });
          if (stuckCount > 0) window.__CLOUD_BUGS__.push({ sev: 'warning', cat: 'logic', msg: 'Найдено ' + stuckCount + ' существ, застрявших в текстурах' });
        }
        
        // Проверка ресурсов
        if (typeof wood !== 'undefined' && wood[0] < 0) window.__CLOUD_BUGS__.push({ sev: 'warning', cat: 'resources', msg: 'Ушло в минус дерево: ' + wood[0] });
        if (typeof minerals !== 'undefined' && minerals.stone < 0) window.__CLOUD_BUGS__.push({ sev: 'warning', cat: 'resources', msg: 'Ушел в минус камень: ' + minerals.stone });
        
        // Проверка памяти
        if (typeof sparks !== 'undefined' && sparks.length > 1500) window.__CLOUD_BUGS__.push({ sev: 'warning', cat: 'memory', msg: 'Переполнение искр (sparks): ' + sparks.length });
        
        // Проверка зданий
        if (typeof builds !== 'undefined') {
          var ghostBuilds = 0;
          for(var bIdx = 0; bIdx < builds.length; bIdx++){
            if(builds[bIdx].hp <= 0) ghostBuilds++;
          }
          if(ghostBuilds > 0) window.__CLOUD_BUGS__.push({ sev: 'warning', cat: 'logic', msg: 'Разрушенные здания (HP <= 0) не удалились: ' + ghostBuilds });
        }
      } catch(e) {}
    }, 2000);
  });

  // Ждем РОВНО 5 МИНУТ (300 000 миллисекунд)
  await new Promise(r => setTimeout(r, 300000)); 

  // 3. Собираем и фильтруем баги
  console.log('3. Собираем результаты...');
  const foundBugs = await page.evaluate(() => window.__CLOUD_BUGS__);
  const allBugs = [...bugs, ...foundBugs];
  
  // Убираем дубликаты (сравниваем по тексту без цифр)
  const uniqueBugs = [];
  const seen = new Set();
  for (const b of allBugs) {
    const cleanMsg = b.msg.replace(/\d+/g, '#');
    if (!seen.has(cleanMsg)) {
      seen.add(cleanMsg);
      uniqueBugs.push(b);
    }
  }

  fs.writeFileSync('bugs.json', JSON.stringify(uniqueBugs, null, 2));
  console.log('Итог: найдено багов (без дублей) -', uniqueBugs.length);

  await browser.close();
})();

const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    console.log('Запуск браузера...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    page.on('pageerror', error => {
      bugs.push({ sev: 'critical', cat: 'Вылет', msg: 'Игра вылетела с ошибкой: ' + error.message });
    });

    console.log('Открываем игру...');
    await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'networkidle2', timeout: 60000 });

    // Ждем, пока игра загрузит свои скрипты
    await page.waitForFunction(() => typeof appState !== 'undefined', { timeout: 10000 });

    console.log('Проходим меню и запускаем игру...');
    await page.evaluate(() => {
      try {
        // 1. Имитируем нажатие "Создать мир"
        if (typeof showKingdomPick === 'function') {
          showKingdomPick('medium');
        }
        
        // 2. Ждем секунду и имитируем выбор королевства
        setTimeout(() => {
          if (typeof kingdomPickList !== 'undefined' && kingdomPickList.length > 0) {
            startGameWithKingdom(kingdomPickList[0]);
          }
        }, 1000);

      } catch(e) {}
    });

    // Ждем 2 секунды, чтобы игра полностью прогрузилась после выбора королевства
    await new Promise(r => setTimeout(r, 2000));

    console.log('Игра запущена! Робот начинает играть...');
    await page.evaluate(() => {
      window.__RUNTIME_BUGS__ = [];
      const addBug = (sev, cat, msg) => {
        if (!window.__RUNTIME_BUGS__.some(b => b.msg === msg)) {
          window.__RUNTIME_BUGS__.push({ sev, cat, msg });
        }
      };

      // Включаем 3х скорость
      if (typeof speedMult !== 'undefined') speedMult = 3;

      // --- РОБОТ ИГРАЕТ (Раз в секунду) ---
      setInterval(() => {
        try {
          // Защита: играем только если игра реально запущена и карта создана
          if (typeof appState === 'undefined' || appState !== 'playing' || typeof WORLD_W === 'undefined') return;

          if (typeof strikeBolt === 'function' && Math.random() > 0.4) {
            strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
          }
          if (typeof makeBeing === 'function' && Math.random() > 0.5) {
            let types = ['beast', 'traitor', 'troll', 'human'];
            makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, types[Math.floor(Math.random()*types.length)], false, null);
          }
          if (typeof spawnBearRaid === 'function' && Math.random() > 0.9) {
            spawnBearRaid();
          }
        } catch(e) {
          addBug('warning', 'Действия', 'Ошибка бота: ' + e.message);
        }
      }, 1000);

      // --- РОБОТ ПРОВЕРЯЕТ ИГРУ (Раз в 1.5 секунды) ---
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          // 1. Проверка существ
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            let zombies = 0, nans = 0, stuck = 0;
            for (let u of beings) {
              if (!u) continue;
              if (u.hp <= 0) zombies++;
              if (!isFinite(u.x) || !isFinite(u.y)) nans++;
              if (typeof walkable === 'function' && !u.swimming && !walkable(u.x, u.y)) stuck++;
            }
            if (zombies > 0) addBug('warning', 'Логика игры', `Найдено ${zombies} мертвых существ (HP < 0) на карте`);
            if (nans > 0) addBug('critical', 'Координаты', `Найдено ${nans} существ с координатами NaN`);
            if (stuck > 0) addBug('warning', 'Физика', `Найдено ${stuck} существ, застрявших в текстурах`);
          }

          // 2. Проверка ресурсов
          if (typeof wood !== 'undefined' && (wood[0] < 0 || wood[1] < 0)) addBug('critical', 'Экономика', `Дерево ушло в минус: Игрок ${wood[0]}, Враг ${wood[1]}`);
          if (typeof food !== 'undefined' && (food[0] < 0 || food[1] < 0)) addBug('critical', 'Экономика', `Еда ушла в минус: Игрок ${food[0]}, Враг ${food[1]}`);
          
          // 3. Проверка зданий
          if (typeof builds !== 'undefined' && Array.isArray(builds)) {
            let ghosts = 0, ruined = 0;
            for (let b of builds) {
              if (b.hp <= 0) ruined++;
              if (b.villageId && !villages[b.villageId]) ghosts++;
            }
            if (ruined > 0) addBug('warning', 'Стройка', `Найдено ${ruined} разрушенных зданий (HP < 0)`);
            if (ghosts > 0) addBug('warning', 'Стройка', `Найдено ${ghosts} зданий-призраков`);
          }

          // 4. Память
          if (typeof sparks !== 'undefined' && sparks.length > 2000) addBug('warning', 'Производительность', `Утечка искр: ${sparks.length} частиц`);
          
        } catch(e) {}
      }, 1500);

    });

    console.log('Играем 5 минут...');
    await new Promise(r => setTimeout(r, 300000)); 

    const foundBugs = await page.evaluate(() => window.__RUNTIME_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();
    console.log('Готово!');

  } catch (err) {
    bugs.push({ sev: 'critical', cat: 'Робот', msg: 'Ошибка запуска: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

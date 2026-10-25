const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    console.log('Запуск браузера для игры...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // 1. Ловим вылеты игры (критические ошибки в консоли)
    page.on('pageerror', error => {
      bugs.push({ sev: 'critical', cat: 'Вылет', msg: 'Игра вылетела с ошибкой: ' + error.message });
    });

    // 2. Открываем игру
    console.log('Загрузка игры...');
    await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 3. Внедряем скрипт "игрока"
    console.log('Робот начинает играть...');
    await page.evaluate(() => {
      window.__RUNTIME_BUGS__ = [];
      const addBug = (sev, cat, msg) => {
        // Защита от спама (если такой баг уже есть, не добавляем)
        if (!window.__RUNTIME_BUGS__.some(b => b.msg === msg)) {
          window.__RUNTIME_BUGS__.push({ sev, cat, msg });
        }
      };

      // --- ЗАПУСК ИГРЫ ---
      try {
        if (typeof generateWorld === 'function') generateWorld();
        if (typeof createKingdoms === 'function') createKingdoms();
        if (typeof appState !== 'undefined') appState = 'playing';
        if (typeof recalcView === 'function') recalcView();
        if (typeof speedMult !== 'undefined') speedMult = 3; // Включаем 3х скорость
      } catch(e) {
        addBug('critical', 'Система', 'Не удалось запустить игру: ' + e.message);
      }

      // --- РОБОТ ИГРАЕТ (Раз в секунду делает пакости) ---
      setInterval(() => {
        try {
          // 1. Бьет молниями
          if (typeof strikeBolt === 'function' && Math.random() > 0.4) {
            strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
          }
          // 2. Спавнит зверей и предателей
          if (typeof makeBeing === 'function' && Math.random() > 0.5) {
            let types = ['beast', 'traitor', 'troll', 'human'];
            makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, types[Math.floor(Math.random()*types.length)], false, null);
          }
          // 3. Иногда вызывает набег медведей
          if (typeof spawnBearRaid === 'function' && Math.random() > 0.9) {
            spawnBearRaid();
          }
        } catch(e) {
          addBug('warning', 'Действия', 'Ошибка во время клика робота: ' + e.message);
        }
      }, 1000);

      // --- РОБОТ ПРОВЕРЯЕТ ИГРУ (Раз в 1.5 секунды) ---
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          // Проверка 1: Существа (люди, звери)
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            let zombies = 0, nans = 0, stuck = 0;
            
            for (let u of beings) {
              if (!u) continue;
              if (u.hp <= 0) zombies++;
              if (!isFinite(u.x) || !isFinite(u.y)) nans++;
              // Проверка на застревание в текстурах (если не плывет)
              if (typeof walkable === 'function' && !u.swimming && !walkable(u.x, u.y)) stuck++;
            }
            
            if (zombies > 0) addBug('warning', 'Логика игры', `Найдено ${zombies} мертвых существ (HP < 0), которые не исчезли с карты`);
            if (nans > 0) addBug('critical', 'Координаты', `Найдено ${nans} существ с поломанными координатами (x или y = NaN)`);
            if (stuck > 0) addBug('warning', 'Физика', `Найдено ${stuck} существ, которые застряли в стенах/горах`);
          }

          // Проверка 2: Ресурсы
          if (typeof wood !== 'undefined' && (wood[0] < 0 || wood[1] < 0)) addBug('critical', 'Экономика', `Дерево ушло в минус: Игрок ${wood[0]}, Враг ${wood[1]}`);
          if (typeof food !== 'undefined' && (food[0] < 0 || food[1] < 0)) addBug('critical', 'Экономика', `Еда ушла в минус: Игрок ${food[0]}, Враг ${food[1]}`);
          
          // Проверка 3: Здания
          if (typeof builds !== 'undefined' && Array.isArray(builds)) {
            let ghosts = 0, ruined = 0;
            for (let b of builds) {
              if (b.hp <= 0) ruined++;
              if (b.villageId && !villages[b.villageId]) ghosts++;
            }
            if (ruined > 0) addBug('warning', 'Стройка', `Найдено ${ruined} разрушенных зданий (HP <= 0), которые зависли на карте`);
            if (ghosts > 0) addBug('warning', 'Стройка', `Найдено ${ghosts} зданий-призраков (привязаны к удаленной деревне)`);
          }

          // Проверка 4: Память и лаги
          if (typeof sparks !== 'undefined' && sparks.length > 2000) {
            addBug('warning', 'Производительность', `Утечка памяти: ${sparks.length} частиц (искр) на карте. Игра начнет лагать.`);
          }
          if (typeof hearts !== 'undefined' && hearts.length > 500) {
            addBug('warning', 'Производительность', `Утечка памяти: ${hearts.length} сердечек на карте.`);
          }
          
        } catch(e) {}
      }, 1500);

    });

    // Ждем 5 минут, пока робот играет
    console.log('Играем 5 минут...');
    await new Promise(r => setTimeout(r, 300000)); 

    // Забираем найденные баги
    const foundBugs = await page.evaluate(() => window.__RUNTIME_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    bugs.push({ sev: 'critical', cat: 'Робот', msg: 'Ошибка запуска: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

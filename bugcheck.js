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
    await page.waitForFunction(() => typeof appState !== 'undefined', { timeout: 10000 });

    console.log('Запускаем игру...');
    await page.evaluate(() => {
      try {
        if (typeof showKingdomPick === 'function') showKingdomPick('medium');
        setTimeout(() => {
          if (typeof kingdomPickList !== 'undefined' && kingdomPickList.length > 0) {
            startGameWithKingdom(kingdomPickList[0]);
          }
        }, 1000);
      } catch(e) {}
    });

    await new Promise(r => setTimeout(r, 2000));

    console.log('Робот начинает играть и проверять...');
    await page.evaluate(() => {
      window.__RUNTIME_BUGS__ = [];
      const addBug = (sev, cat, msg) => {
        // Защита от спама (не пишем одинаковые сообщения)
        if (!window.__RUNTIME_BUGS__.some(b => b.msg === msg)) {
          window.__RUNTIME_BUGS__.push({ sev, cat, msg });
        }
      };

      if (typeof speedMult !== 'undefined') speedMult = 3;

      // Словарь для перевода имен
      const getEntityName = (u) => {
        if (u.type === 'human') return u.isBaby ? 'Ребенок' : (u.gender === 1 ? 'Женщина' : 'Мужчина');
        if (u.type === 'warrior') return 'Воин';
        if (u.type === 'beast') return 'Медведь';
        if (u.type === 'traitor') return 'Предатель';
        if (u.type === 'troll') return 'Тролль';
        if (u.type === 'shadow') return 'Тень';
        return u.type;
      };

      // --- РОБОТ ИГРАЕТ ---
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing' || typeof WORLD_W === 'undefined') return;
          if (typeof strikeBolt === 'function' && Math.random() > 0.4) {
            strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
          }
          if (typeof makeBeing === 'function' && Math.random() > 0.5) {
            let types = ['beast', 'traitor', 'troll', 'human'];
            makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, types[Math.floor(Math.random()*types.length)], false, null);
          }
        } catch(e) {}
      }, 1000);

      // --- УМНАЯ ПРОВЕРКА (Раз в 1.5 секунды) ---
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          // 1. ГЛУБОКАЯ ПРОВЕРКА СУЩЕСТВ
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            let zombies = [];
            let nans = [];
            let stuckInTree = [];
            let stuckInRock = [];
            let stuckInWater = [];
            let stuckInMountain = [];

            for (let u of beings) {
              if (!u) continue;
              let name = getEntityName(u);

              // Мертвые (зомби)
              if (u.hp <= 0) {
                if (!zombies.includes(name)) zombies.push(name);
              }
              
              // Сломанные координаты
              if (!isFinite(u.x) || !isFinite(u.y)) {
                if (!nans.includes(name)) nans.push(name);
                continue; // Дальше проверять смысла нет
              }

              // Застревания (только если не плывет)
              if (typeof walkable === 'function' && !u.swimming) {
                let tx = Math.floor(u.x / 26);
                let ty = Math.floor(u.y / 26);
                let tile = tiles[ty * 64 + tx]; // Тип поверхности

                if (tile === 1) { if(!stuckInWater.includes(name)) stuckInWater.push(name); }
                else if (tile === 2) { if(!stuckInMountain.includes(name)) stuckInMountain.push(name); }
                else {
                  // Проверяем деревья
                  let inTree = false;
                  for (let t of trees) {
                    if (Math.hypot(t.x - u.x, t.y - u.y) < u.size + 5) { inTree = true; break; }
                  }
                  if (inTree) { if(!stuckInTree.includes(name)) stuckInTree.push(name); }
                  
                  // Проверяем камни
                  if (!inTree) {
                    let inRock = false;
                    for (let r of rocks) {
                      if (Math.hypot(r.x - u.x, r.y - u.y) < u.size + 5) { inRock = true; break; }
                    }
                    if (inRock) { if(!stuckInRock.includes(name)) stuckInRock.push(name); }
                  }
                }
              }
            }

            // Формируем красивые и конкретные отчеты
            if (zombies.length > 0) addBug('warning', 'Смерть', `Мертвые существа (${zombies.join(', ')}) с HP < 0 не исчезли с карты`);
            if (nans.length > 0) addBug('critical', 'Координаты', `Существа (${nans.join(', ')}) провалились в "пустоту" (координаты NaN)`);
            
            if (stuckInTree.length > 0) addBug('warning', 'Застревание', `Существа (${stuckInTree.join(', ')}) застряли внутри дерева`);
            if (stuckInRock.length > 0) addBug('warning', 'Застревание', `Существа (${stuckInRock.join(', ')}) застряли внутри камня/валуна`);
            if (stuckInWater.length > 0) addBug('warning', 'Физика', `Существа (${stuckInWater.join(', ')}) застряли в воде (утонули, но не плывут)`);
            if (stuckInMountain.length > 0) addBug('warning', 'Физика', `Существа (${stuckInMountain.join(', ')}) застряли внутри горы`);
          }

          // 2. ПРОВЕРКА РЕСУРСОВ
          if (typeof wood !== 'undefined' && (wood[0] < 0 || wood[1] < 0)) addBug('critical', 'Экономика', `Дерево ушло в минус: Игрок ${wood[0]}, Враг ${wood[1]}`);
          if (typeof food !== 'undefined' && (food[0] < 0 || food[1] < 0)) addBug('critical', 'Экономика', `Еда ушла в минус: Игрок ${food[0]}, Враг ${food[1]}`);
          
          // 3. ПРОВЕРКА ЗДАНИЙ
          if (typeof builds !== 'undefined' && Array.isArray(builds)) {
            let ghosts = 0, ruined = 0;
            for (let b of builds) {
              if (b.hp <= 0) ruined++;
              if (b.villageId && !villages[b.villageId]) ghosts++;
            }
            if (ruined > 0) addBug('warning', 'Стройка', `Найдено ${ruined} разрушенных зданий (HP < 0), они не исчезли`);
            if (ghosts > 0) addBug('warning', 'Стройка', `Найдено ${ghosts} зданий-призраков (дом есть, а деревни нет)`);
          }

          // 4. ПРОИЗВОДИТЕЛЬНОСТЬ
          if (typeof sparks !== 'undefined' && sparks.length > 2000) addBug('warning', 'Память', `Утечка искр (${sparks.length}). Игра начнет лагать.`);
          
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

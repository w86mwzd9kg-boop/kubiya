const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    // --- 1. СТАТИЧЕСКИЙ АНАЛИЗ (Проверка кода) ---
    console.log('Читаем index.html...');
    let html = '';
    try { html = fs.readFileSync('index.html', 'utf8'); } catch (e) {}

    if (html.includes('a.isExposed')) bugs.push({ sev: 'critical', cat: 'Код', msg: 'hostile(): проверяется a.isExposed вместо b.isExposed (предателей нельзя убить)' });
    if (html.includes('999 : 150') || html.includes('999: 150')) bugs.push({ sev: 'warning', cat: 'Код', msg: 'Урон Божественной Кары (999) не убивает медведя на "Безумии"' });
    
    bugs.push({ sev: 'info', cat: 'Система', msg: 'Статический анализ файла завершен' });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));

    // --- 2. ДИНАМИЧЕСКИЙ АНАЛИЗ (Запуск игры и жестокие тесты) ---
    console.log('Запуск браузера...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('pageerror', err => bugs.push({ sev: 'critical', cat: 'Вылет', msg: 'Игра вылетела с ошибкой: ' + err.message }));

    await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Внедряем тесты в игру...');
    await page.evaluate(() => {
      window.__TEST_BUGS__ = [];
      const report = (sev, cat, msg) => { if (!window.__TEST_BUGS__.some(b => b.msg === msg)) window.__TEST_BUGS__.push({ sev, cat, msg }); };

      // Принудительный старт игры
      try {
        if (typeof generateWorld === 'function') generateWorld();
        if (typeof createKingdoms === 'function') createKingdoms();
        if (typeof appState !== 'undefined') appState = 'playing';
        if (typeof recalcView === 'function') recalcView();
      } catch(e) {}

      // --- СЦЕНАРИЙ 1: Тест боя (Предатель, Медведь, Враг) ---
      setTimeout(() => {
        try {
          const cX = WORLD_W / 2, cY = WORLD_H / 2;
          
          // 1. Житель против Предателя
          let human = makeBeing(cX, cY, 'human', false, null);
          let traitor = makeBeing(cX + 20, cY, 'traitor', false, null);
          if (human && traitor) {
            traitor.isExposed = true;
            if (!hostile(human, traitor)) report('critical', 'Бой', 'Житель НЕ атакует раскрытого предателя (hostile вернул false)');
          }

          // 2. Житель против Медведя
          let bear = makeBeing(cX - 20, cY, 'beast', false, null);
          if (human && bear && !hostile(human, bear)) report('critical', 'Бой', 'Житель НЕ атакует медведя');
          
          // 3. Лечение и голод (не должны уходить в минус)
          human.hp = -50; human.hunger = -100;
        } catch(e) { report('warning', 'Тесты', 'Ошибка спавна существ: ' + e.message); }
      }, 2000);

      // --- СЦЕНАРИЙ 2: Тест ресурсов (Минус) ---
      setTimeout(() => {
        try {
          if (typeof wood !== 'undefined') { wood[0] = -500; wood[1] = -300; }
          if (typeof food !== 'undefined') { food[0] = -100; }
          if (typeof minerals !== 'undefined') { minerals.stone = -50; }
        } catch(e) {}
      }, 4000);

      // --- СЦЕНАРИЙ 3: Тест зданий и деревень ---
      setTimeout(() => {
        try {
          if (typeof placeBuild === 'function') {
            let ghost = placeBuild(WORLD_W/2, WORLD_H/2, 'cottage', 0, 9999); // Деревня 9999 не существует
            let ruined = placeBuild(WORLD_W/2 + 40, WORLD_H/2, 'tower', 0, 1);
            ruined.hp = -10; ruined.level = 99; // Неверный уровень
          }
        } catch(e) {}
      }, 6000);

      // --- СЦЕНАРИЙ 4: Постоянный стресс-тест и мониторинг ---
      setInterval(() => {
        try {
          if (typeof speedMult !== 'undefined') speedMult = 3;
          if (typeof strikeBolt === 'function' && Math.random() > 0.5) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
        } catch(e) {}
      }, 1000);

      // --- СЦЕНАРИЙ 5: Сканер аномалий (каждые 1.5 сек) ---
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          // 1. Сканер существ
          if (typeof beings !== 'undefined') {
            let zombies = 0, nans = 0, stuck = 0;
            for (let u of beings) {
              if (!u) continue;
              if (u.hp <= 0) zombies++;
              if (!isFinite(u.x) || !isFinite(u.y)) nans++;
              if (typeof walkable === 'function' && !u.swimming && !walkable(u.x, u.y)) stuck++;
            }
            if (zombies > 0) report('warning', 'Логика', `Зомби: ${zombies} существ с HP <= 0 не удалились из мира`);
            if (nans > 0) report('critical', 'Координаты', `NaN: ${nans} существ имеют сломанные координаты (x или y = NaN)`);
            if (stuck > 0) report('warning', 'Физика', `Застревание: ${stuck} существ застряли внутри текстур`);
          }

          // 2. Сканер ресурсов
          if (typeof wood !== 'undefined' && (wood[0] < 0 || wood[1] < 0)) report('critical', 'Ресурсы', `Дерево ушло в минус: Игрок ${wood[0]}, Враг ${wood[1]}`);
          if (typeof food !== 'undefined' && (food[0] < 0 || food[1] < 0)) report('critical', 'Ресурсы', `Еда ушла в минус: Игрок ${food[0]}, Враг ${food[1]}`);
          if (typeof minerals !== 'undefined') {
             for(let k in minerals) if(minerals[k] < 0) report('critical', 'Ресурсы', `Ресурс (${k}) ушел в минус: ${minerals[k]}`);
          }

          // 3. Сканер зданий
          if (typeof builds !== 'undefined') {
            let ghosts = 0, ruins = 0, badLvl = 0;
            for (let b of builds) {
              if (b.villageId && (!villages[b.villageId])) ghosts++;
              if (b.hp <= 0) ruins++;
              if (b.level > 3 || b.level < 1) badLvl++;
            }
            if (ghosts > 0) report('warning', 'Здания', `Здания-призраки: ${ghosts} домов привязаны к несуществующей деревне`);
            if (ruins > 0) report('warning', 'Здания', `Руины: ${ruins} зданий с HP <= 0 не удалились`);
            if (badLvl > 0) report('critical', 'Здания', `Сломан уровень: ${badLvl} зданий имеют уровень > 3 или < 1`);
          }

          // 4. Сканер интерфейса и памяти
          if (typeof zoom !== 'undefined' && (zoom <= 0.05 || !isFinite(zoom))) report('critical', 'Интерфейс', `Сломан зум: ${zoom}`);
          if (typeof sparks !== 'undefined' && sparks.length > 2000) report('warning', 'Память', `Утечка искр: ${sparks.length} шт. (вызывает лаги)`);

        } catch(e) {}
      }, 1500);
    });

    console.log('Ждем 3 минуты...');
    await new Promise(r => setTimeout(r, 180000)); 

    console.log('Сбор данных...');
    const dynamicBugs = await page.evaluate(() => window.__TEST_BUGS__);
    bugs = bugs.concat(dynamicBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    bugs.push({ sev: 'critical', cat: 'Робот', msg: 'Ошибка скрипта: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

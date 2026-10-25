const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    page.on('pageerror', error => {
      bugs.push({ sev: 'critical', cat: '🚨 Вылет', msg: 'Игра вылетела с ошибкой: ' + error.message });
    });

    await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => typeof appState !== 'undefined', { timeout: 10000 });

    // Запуск игры
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

    console.log('Запуск 6 ботов-тестировщиков...');
    await page.evaluate(() => {
      window.__RUNTIME_BUGS__ = [];
      const addBug = (sev, cat, msg) => {
        if (!window.__RUNTIME_BUGS__.some(b => b.msg === msg)) {
          window.__RUNTIME_BUGS__.push({ sev, cat, msg });
        }
      };

      if (typeof speedMult !== 'undefined') speedMult = 3;

      const getEntityName = (u) => {
        if (u.type === 'human') return u.isBaby ? 'Ребенок' : (u.gender === 1 ? 'Женщина' : 'Мужчина');
        if (u.type === 'warrior') return 'Воин'; if (u.type === 'beast') return 'Медведь';
        if (u.type === 'traitor') return 'Предатель'; if (u.type === 'troll') return 'Тролль';
        return u.type;
      };

      const getBuildName = (type) => {
        const names = {
          cottage: 'Хижина', tent: 'Шатёр', warehouse: 'Склад', forge: 'Кузница', 
          tavern: 'Таверна', tower: 'Башня', wallwood: 'Деревянная стена', wallstone: 'Каменная стена'
        };
        return names[type] || type;
      };

      // --- ИГРОВАЯ СИМУЛЯЦИЯ ---
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing' || typeof WORLD_W === 'undefined') return;
          if (typeof strikeBolt === 'function' && Math.random() > 0.4) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
          if (typeof makeBeing === 'function' && Math.random() > 0.5) {
            let types = ['beast', 'traitor', 'troll', 'human'];
            makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, types[Math.floor(Math.random()*types.length)], false, null);
          }
        } catch(e) {}
      }, 1000);

      // ==========================================
      // БОТ-АРХИТЕКТОР: ПРОВЕРКА МОДЕЛЕК ДОМОВ (НОВОЕ!)
      // ==========================================
      try {
        // 1. Перехватываем отрисовку самого здания
        const origPaintBuild = window.paintBuild;
        window.paintBuild = function(b) {
          if (b) {
            let name = getBuildName(b.type);
            
            // Проверка координат самого здания
            if (!isFinite(b.x) || !isFinite(b.y)) {
              addBug('critical', '🏠 Дома', `Проблема с моделькой: Дом (${name}) имеет сломанные координаты (NaN)`);
            } else if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
              addBug('warning', '🏠 Дома', `Моделька дома (${name}) улетела за пределы карты`);
            }
            
            // Проверка уровней
            if (b.level > 3 || b.level < 1) {
              addBug('critical', '🏠 Дома', `Проблема с моделькой: Дом (${name}) имеет неверный уровень (${b.level})`);
            }
          }
          return origPaintBuild.apply(this, arguments);
        };

        // 2. Перехватываем отрисовку дымохода (чтобы ловить его "отвязывание")
        const origDrawChimney = window.drawChimney;
        if (origDrawChimney) {
          window.drawChimney = function(cx, topY, cw, chh, fl) {
            if (isNaN(cx) || isNaN(topY) || isNaN(cw) || isNaN(chh)) {
              addBug('critical', '🏠 Дома', `Проблема с моделькой: Дымоход открепился от дома (координаты NaN)`);
            } else if (cw <= 0 || chh <= 0) {
              addBug('warning', '🏠 Дома', `Проблема с моделькой: У дымохода сломан размер (w:${cw}, h:${chh})`);
            }
            return origDrawChimney.apply(this, arguments);
          };
        }
      } catch(e) {}

      // ==========================================
      // БОТ 1: ПЕРЕХВАТЧИК ГРАФИКИ (Общий)
      // ==========================================
      try {
        const origFillRect = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
          if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
            addBug('critical', '👁 Графика', `Объект нарисован со сломанными координатами (NaN)!`);
          } else if (w < 0 || h < 0) {
            addBug('warning', '👁 Графика', `Объект нарисован с отрицательным размером (w:${w}, h:${h})`);
          }
          return origFillRect.apply(this, arguments);
        };
      } catch(e) {}

      // ==========================================
      // БОТ 2: ГЕЙМДИЗАЙНЕР (Экономика и правила)
      // ==========================================
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;
          if (typeof wood !== 'undefined' && (wood[0] < 0 || wood[1] < 0)) addBug('critical', '⚙️ Геймдизайнер', `Дерево ушло в минус (Игрок: ${wood[0]}, Враг: ${wood[1]})`);
          if (typeof food !== 'undefined' && (food[0] < 0 || food[1] < 0)) addBug('critical', '⚙️ Геймдизайнер', `Еда ушла в минус (Игрок: ${food[0]}, Враг: ${food[1]})`);
          
          if (typeof builds !== 'undefined') {
            for (let b of builds) {
              if (b.hp > b.maxHp + 10) addBug('warning', '⚙️ Геймдизайнер', `У здания (${getBuildName(b.type)}) HP больше максимума (${b.hp}/${b.maxHp})`);
              if (b.hp <= 0) addBug('warning', '⚙️ Геймдизайнер', `Дом (${getBuildName(b.type)}) сломан (HP < 0), но не исчез`);
            }
          }
        } catch(e) {}
      }, 2000);

      // ==========================================
      // БОТ 3: ФИЗИК (Коллизии и застревания)
      // ==========================================
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;
          if (typeof beings !== 'undefined') {
            let stuckTree = [], stuckRock = [], stuckWater = [], stuckMountain = [];
            for (let u of beings) {
              if (!u || !isFinite(u.x) || !isFinite(u.y) || u.swimming) continue;
              let name = getEntityName(u);
              let tx = Math.floor(u.x / 26); let ty = Math.floor(u.y / 26);
              let tile = tiles[ty * 64 + tx];

              if (tile === 1) { if(!stuckWater.includes(name)) stuckWater.push(name); }
              else if (tile === 2) { if(!stuckMountain.includes(name)) stuckMountain.push(name); }
              else {
                for (let t of trees) { if (Math.hypot(t.x - u.x, t.y - u.y) < u.size) { if(!stuckTree.includes(name)) stuckTree.push(name); break; } }
                for (let r of rocks) { if (Math.hypot(r.x - u.x, r.y - u.y) < u.size) { if(!stuckRock.includes(name)) stuckRock.push(name); break; } }
              }
            }
            if (stuckTree.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckTree.join(', ')}) застряли в дереве`);
            if (stuckRock.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckRock.join(', ')}) застряли в камне`);
            if (stuckWater.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckWater.join(', ')}) застряли в воде`);
            if (stuckMountain.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckMountain.join(', ')}) застряли в горе`);
          }
        } catch(e) {}
      }, 1500);

      // ==========================================
      // БОТ 4: ОПТИМИЗАТОР (Лаги и память)
      // ==========================================
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;
          if (typeof sparks !== 'undefined' && sparks.length > 1500) addBug('warning', '🔥 Оптимизатор', `Утечка памяти: ${sparks.length} искр (будут лаги)`);
          if (typeof hearts !== 'undefined' && hearts.length > 300) addBug('warning', '🔥 Оптимизатор', `Утечка памяти: ${hearts.length} сердечек`);
        } catch(e) {}
      }, 2000);

    });

    console.log('Играем 10 минут...');
    await new Promise(r => setTimeout(r, 600000)); // 10 минут

    const foundBugs = await page.evaluate(() => window.__RUNTIME_BUGS__);
    bugs = bugs.concat(foundBugs);
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    bugs.push({ sev: 'critical', cat: '🚨 Система', msg: 'Ошибка запуска: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

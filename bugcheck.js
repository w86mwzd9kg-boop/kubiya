const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    console.log('Запуск браузера...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    page.on('pageerror', error => {
      bugs.push({ sev: 'critical', cat: '🚨 Вылет', msg: 'Игра вылетела с ошибкой: ' + error.message });
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

    console.log('Команда ботов приступила к работе...');
    await page.evaluate(() => {
      window.__RUNTIME_BUGS__ = [];
      
      // Универсальная функция записи багов
      const addBug = (sev, cat, msg) => {
        if (!window.__RUNTIME_BUGS__.some(b => b.msg === msg)) {
          window.__RUNTIME_BUGS__.push({ sev, cat, msg });
        }
      };

      if (typeof speedMult !== 'undefined') speedMult = 3;

      const getEntityName = (u) => {
        if (u.type === 'human') return u.isBaby ? 'Ребенок' : (u.gender === 1 ? 'Женщина' : 'Мужчина');
        if (u.type === 'warrior') return 'Воин';
        if (u.type === 'beast') return 'Медведь';
        if (u.type === 'traitor') return 'Предатель';
        if (u.type === 'troll') return 'Тролль';
        if (u.type === 'shadow') return 'Тень';
        return u.type;
      };

      // Робот играет (имитация действий игрока)
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
      // БОТ 1: МОДЕЛЬЕР (Проверка визуала и моделей)
      // ==========================================
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;
          
          if (typeof beings !== 'undefined') {
            for (let u of beings) {
              if (!u) continue;
              let name = getEntityName(u);
              if (isNaN(u.size) || u.size <= 0) addBug('critical', '🤖 Модельер', `У существа (${name}) сломан размер модельки (size = ${u.size})`);
              if (u.x < 0 || u.x > WORLD_W || u.y < 0 || u.y > WORLD_H) addBug('warning', '🤖 Модельер', `Существо (${name}) вышло за пределы карты`);
            }
          }
          if (typeof zoom !== 'undefined' && (isNaN(zoom) || zoom <= 0.01)) {
             addBug('critical', '🤖 Модельер', `Сломался зум камеры (zoom = ${zoom}). Экран станет черным.`);
          }
        } catch(e) {}
      }, 1500);

      // ==========================================
      // БОТ 2: ГЕЙМДИЗАЙНЕР (Проверка правил и механик)
      // ==========================================
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          // Ресурсы в минус
          if (typeof wood !== 'undefined' && (wood[0] < 0 || wood[1] < 0)) addBug('critical', '⚙️ Геймдизайнер', `Сломана экономика: дерево ушло в минус (Игрок: ${wood[0]}, Враг: ${wood[1]})`);
          if (typeof food !== 'undefined' && (food[0] < 0 || food[1] < 0)) addBug('critical', '⚙️ Геймдизайнер', `Сломана экономика: еда ушла в минус (Игрок: ${food[0]}, Враг: ${food[1]})`);
          
          // Здоровье и здания
          if (typeof builds !== 'undefined') {
            for (let b of builds) {
              if (b.level > 3 || b.level < 1) addBug('critical', '⚙️ Геймдизайнер', `Сломан уровень здания (${b.type}): уровень ${b.level}`);
              if (b.hp > b.maxHp + 10) addBug('warning', '⚙️ Геймдизайнер', `У здания (${b.type}) здоровье больше максимума (${b.hp}/${b.maxHp})`);
            }
          }

          // Мертвые юниты
          if (typeof beings !== 'undefined') {
            let deadCount = 0;
            for (let u of beings) if (u && u.hp <= 0) deadCount++;
            if (deadCount > 0) addBug('warning', '⚙️ Геймдизайнер', `В мире зависли мертвые юниты (HP < 0): ${deadCount} шт.`);
          }
        } catch(e) {}
      }, 2000);

      // ==========================================
      // БОТ 3: ФИЗИК (Проверка коллизий и застреваний)
      // ==========================================
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          if (typeof beings !== 'undefined') {
            let stuckTree = [], stuckRock = [], stuckWater = [], stuckMountain = [];
            
            for (let u of beings) {
              if (!u || !isFinite(u.x) || !isFinite(u.y) || u.swimming) continue;
              let name = getEntityName(u);
              let tx = Math.floor(u.x / 26);
              let ty = Math.floor(u.y / 26);
              let tile = tiles[ty * 64 + tx];

              if (tile === 1) { if(!stuckWater.includes(name)) stuckWater.push(name); }
              else if (tile === 2) { if(!stuckMountain.includes(name)) stuckMountain.push(name); }
              else {
                for (let t of trees) { if (Math.hypot(t.x - u.x, t.y - u.y) < u.size) { if(!stuckTree.includes(name)) stuckTree.push(name); break; } }
                for (let r of rocks) { if (Math.hypot(r.x - u.x, r.y - u.y) < u.size) { if(!stuckRock.includes(name)) stuckRock.push(name); break; } }
              }
            }

            if (stuckTree.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckTree.join(', ')}) застряли внутри дерева`);
            if (stuckRock.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckRock.join(', ')}) застряли внутри камня`);
            if (stuckWater.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckWater.join(', ')}) застряли в воде (не плывут)`);
            if (stuckMountain.length > 0) addBug('warning', '🧱 Физик', `Существа (${stuckMountain.join(', ')}) застряли в горе`);
          }
        } catch(e) {}
      }, 1500);

      // ==========================================
      // БОТ 4: ОПТИМИЗАТОР (Утечки памяти и лаги)
      // ==========================================
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;
          
          if (typeof sparks !== 'undefined' && sparks.length > 1500) addBug('warning', '🔥 Оптимизатор', `Утечка памяти: на карте ${sparks.length} искр (может вызвать лаги)`);
          if (typeof hearts !== 'undefined' && hearts.length > 300) addBug('warning', '🔥 Оптимизатор', `Утечка памяти: на карте ${hearts.length} сердечек`);
          if (typeof trees !== 'undefined' && trees.length > 600) addBug('info', '🔥 Оптимизатор', `Слишком много деревьев на карте: ${trees.length} (лимит движка 500)`);
          if (typeof animals !== 'undefined' && animals.length > 400) addBug('info', '🔥 Оптимизатор', `Перенаселение животных: ${animals.length} шт.`);
          
        } catch(e) {}
      }, 2000);

    });

    console.log('Играем 10 минут. Боты работают...');
    await new Promise(r => setTimeout(r, 600000)); // 10 минут

    const foundBugs = await page.evaluate(() => window.__RUNTIME_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();
    console.log('Готово!');

  } catch (err) {
    bugs.push({ sev: 'critical', cat: '🚨 Система', msg: 'Ошибка запуска: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

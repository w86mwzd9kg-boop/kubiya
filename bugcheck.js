const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    page.on('pageerror', error => {
      bugs.push({ sev: 'critical', cat: 'Вылет', msg: 'Ошибка в консоли: ' + error.message });
    });

    console.log('Загрузка игры...');
    const response = await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const html = await response.text();

    // --- СТАТИЧЕСКИЙ АНАЛИЗ (Проверка кода) ---
    console.log('Проверка кода...');
    if (/if\s*\(\s*a\.isExposed\s*\)/.test(html)) {
      bugs.push({ sev: 'critical', cat: 'Код', msg: 'В функции hostile() проверяется a.isExposed вместо b.isExposed (жители не атакуют предателя)' });
    }
    if (/mode\s*===\s*['"]divine['"]\s*\?\s*999/.test(html)) {
      bugs.push({ sev: 'warning', cat: 'Код', msg: 'Урон Божественной Кары (999) меньше HP медведя на сложности "Безумие" (1000)' });
    }

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));

    // --- ДИНАМИЧЕСКИЙ АНАЛИЗ (Игра) ---
    console.log('Запуск игры и симуляция...');
    await page.evaluate(() => {
      window.__CLOUD_BUGS__ = [];
      
      const addBug = (sev, cat, msg) => {
        window.__CLOUD_BUGS__.push({ sev, cat, msg });
      };

      // Имитация игрока (спавним предателей, бьем молниями)
      setInterval(() => {
        try {
          if (typeof strikeBolt === 'function' && Math.random() > 0.5) {
            strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
          }
          if (typeof makeBeing === 'function' && Math.random() > 0.6) {
            makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.random() > 0.5 ? 'traitor' : 'beast', false, null);
          }
        } catch(e) {}
      }, 1000);

      // ГЛУБОКАЯ ПРОВЕРКА ВСЕХ СИСТЕМ (каждые 2 секунды)
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          // 1. Проверка существ
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            let zombies = [], nanEntities = [], stuckEntities = [];
            
            for (let u of beings) {
              if (!u) continue;
              let typeName = u.type === 'human' ? (u.isBaby ? 'Младенец' : 'Человек') : u.type;
              
              if (u.hp <= 0) zombies.push(typeName);
              if (!isFinite(u.x) || !isFinite(u.y)) nanEntities.push(typeName);
              if (typeof walkable === 'function' && !u.swimming && !walkable(u.x, u.y)) stuckEntities.push(typeName);
            }
            
            if (zombies.length > 0) addBug('warning', 'Логика', `Зомби: ${zombies.length} существ с HP <= 0 (${zombies[0]} и др.) всё ещё в мире`);
            if (nanEntities.length > 0) addBug('critical', 'Координаты', `NaN: ${nanEntities.length} существ (${nanEntities[0]}) имеют сломанные координаты (x или y = NaN)`);
            if (stuckEntities.length > 0) addBug('warning', 'Физика', `Застревание: ${stuckEntities.length} существ (${stuckEntities[0]}) застряли внутри непроходимой текстуры`);
            
            // Проверка лимита популяции
            if (typeof upgrades !== 'undefined' && beings.length > upgrades.popLimit + 50) {
               addBug('info', 'Лимиты', `Перенаселение: Существ ${beings.length} при лимите ${upgrades.popLimit}`);
            }
          }

          // 2. Проверка зданий
          if (typeof builds !== 'undefined' && Array.isArray(builds)) {
            let ruinedBuilds = [];
            for (let b of builds) {
              if (b.hp <= 0) ruinedBuilds.push(b.type);
            }
            if (ruinedBuilds.length > 0) addBug('warning', 'Стройка', `Руины: ${ruinedBuilds.length} зданий (${ruinedBuilds[0]}) с HP <= 0 не удалились с карты`);
          }

          // 3. Проверка ресурсов
          if (typeof wood !== 'undefined') {
            if (wood[0] < 0) addBug('warning', 'Ресурсы', `Игрок: Дерево ушло в минус (${wood[0]})`);
            if (wood[1] < 0) addBug('warning', 'Ресурсы', `Враг: Дерево ушло в минус (${wood[1]})`);
          }
          if (typeof minerals !== 'undefined') {
            for (let k in minerals) {
              if (minerals[k] < 0) addBug('warning', 'Ресурсы', `Игрок: Камень/Руда (${k}) ушли в минус (${minerals[k]})`);
            }
          }
          if (typeof food !== 'undefined') {
            if (food[0] < 0) addBug('warning', 'Ресурсы', `Игрок: Еда ушла в минус (${food[0]})`);
          }

          // 4. Проверка производительности и памяти
          if (typeof sparks !== 'undefined' && sparks.length > 2500) {
            addBug('warning', 'Память', `Утечка искр: на карте ${sparks.length} частиц (норма < 1500). Игра начнет лагать.`);
          }
          if (typeof animals !== 'undefined' && animals.length > 500) {
            addBug('info', 'Лимиты', `Перенаселение животных: ${animals.length} штук`);
          }

          // 5. Проверка камеры
          if (typeof zoom !== 'undefined') {
            if (zoom <= 0.1 || !isFinite(zoom)) addBug('critical', 'Интерфейс', `Сломан зум: значение равно ${zoom}. Экран станет черным.`);
          }

        } catch(e) {}
      }, 2000);
    });

    console.log('Ждем 5 минут...');
    await new Promise(r => setTimeout(r, 300000)); 

    console.log('Сбор результатов...');
    const foundBugs = await page.evaluate(() => window.__CLOUD_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    bugs.push({ sev: 'critical', cat: 'Робот', msg: 'Ошибка скрипта: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

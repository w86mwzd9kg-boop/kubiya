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

    // СТАТИЧЕСКИЙ АНАЛИЗ (Проверка текста кода)
    console.log('Проверка кода...');
    if (/if\s*\(\s*a\.isExposed\s*\)/.test(html)) bugs.push({ sev: 'critical', cat: 'Код', msg: 'hostile(): проверяется a.isExposed вместо b.isExposed (предателей нельзя убить)' });
    if (/mode\s*===\s*['"]divine['"]\s*\?\s*999/.test(html)) bugs.push({ sev: 'warning', cat: 'Код', msg: 'Урон Кары (999) не убивает медведя на "Безумии"' });

    // ДИНАМИЧЕСКИЙ АНАЛИЗ (Запуск и стресс-тест)
    console.log('Запуск игры и экстремальный тест...');
    await page.evaluate(() => {
      window.__ALL_BUGS__ = [];
      const addBug = (sev, cat, msg) => {
        // Защита от спама: добавляем, только если такого бага еще нет
        if (!window.__ALL_BUGS__.some(b => b.msg === msg)) {
          window.__ALL_BUGS__.push({ sev, cat, msg });
        }
      };

      // 1. Робот делает игру невыносимой (стресс-тест)
      setInterval(() => {
        try {
          if (typeof speedMult !== 'undefined') speedMult = 3; // Ускоряем время
          if (typeof strikeBolt === 'function' && Math.random() > 0.3) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.random() > 0.5 ? 'divine' : 'normal');
          if (typeof makeBeing === 'function' && Math.random() > 0.4) makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, ['traitor', 'beast', 'troll'][Math.floor(Math.random()*3)], false, null);
          if (typeof spawnBearRaid === 'function' && Math.random() > 0.7) spawnBearRaid();
        } catch(e) {}
      }, 600);

      // 2. Тотальная проверка всех параметров (каждую секунду)
      setInterval(() => {
        try {
          if (typeof appState === 'undefined' || appState !== 'playing') return;

          // --- ПРОВЕРКА СУЩЕСТВ (Богов, людей, зверей) ---
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            for (let u of beings) {
              if (!u) continue;
              let type = u.type === 'human' ? (u.gender === 1 ? 'Женщина' : 'Мужчина') : u.type;
              if (u.isBaby) type = 'Ребенок';
              
              if (u.hp <= 0) addBug('warning', 'Существа', `Найден мертвый юнит (${type}) с HP: ${Math.round(u.hp)} (не удалился)`);
              if (u.hp > u.maxHp + 1) addBug('warning', 'Существа', `Юнит (${type}) имеет HP больше максимума: ${Math.round(u.hp)}/${u.maxHp}`);
              if (u.hunger < 0) addBug('warning', 'Существа', `У юнита (${type}) голод ушел в минус: ${Math.round(u.hunger)}`);
              if (u.hunger > 100) addBug('info', 'Существа', `У юнита (${type}) голод больше 100: ${Math.round(u.hunger)}`);
              if (!isFinite(u.x) || !isFinite(u.y)) addBug('critical', 'Координаты', `Юнит (${type}) имеет сломанные координаты (NaN)`);
              
              // Проверка застревания
              if (typeof walkable === 'function' && !u.swimming) {
                let tx = Math.floor(u.x / 26);
                let ty = Math.floor(u.y / 26);
                if (typeof tiles !== 'undefined' && tiles[ty * 64 + tx] && !walkable(u.x, u.y)) {
                   addBug('warning', 'Физика', `Юнит (${type}) застрял в стене/воде на x:${Math.round(u.x)} y:${Math.round(u.y)}`);
                }
              }
            }
          }

          // --- ПРОВЕРКА ЗДАНИЙ ---
          if (typeof builds !== 'undefined' && Array.isArray(builds)) {
            for (let b of builds) {
              if (b.hp <= 0) addBug('warning', 'Здания', `Здание (${b.type}) сломано (HP <= 0), но не исчезло`);
              if (b.hp > b.maxHp + 1) addBug('warning', 'Здания', `Здание (${b.type}) имеет HP больше максимума`);
              if (b.level > 3 || b.level < 1) addBug('critical', 'Здания', `Здание (${b.type}) имеет неверный уровень: ${b.level}`);
            }
          }

          // --- ПРОВЕРКА РЕСУРСОВ ---
          if (typeof wood !== 'undefined') {
            if (wood[0] < 0) addBug('critical', 'Ресурсы', `У игрока дерево ушло в минус: ${wood[0]}`);
            if (wood[1] < 0) addBug('critical', 'Ресурсы', `У врага дерево ушло в минус: ${wood[1]}`);
          }
          if (typeof minerals !== 'undefined') {
            for (let k in minerals) { if (minerals[k] < 0) addBug('critical', 'Ресурсы', `Ресурс ${k} ушел в минус: ${minerals[k]}`); }
          }
          if (typeof food !== 'undefined') {
            if (food[0] < 0) addBug('critical', 'Ресурсы', `У игрока еда ушла в минус: ${food[0]}`);
            if (food[1] < 0) addBug('critical', 'Ресурсы', `У врага еда ушла в минус: ${food[1]}`);
          }

          // --- ПРОВЕРКА МАССИВОВ И УТЕЧЕК ПАМЯТИ ---
          if (typeof sparks !== 'undefined' && sparks.length > 2000) addBug('warning', 'Память', `Утечка искр: ${sparks.length} шт. (может вызвать лаги)`);
          if (typeof hearts !== 'undefined' && hearts.length > 500) addBug('warning', 'Память', `Утечка сердечек: ${hearts.length} шт.`);
          if (typeof bolts !== 'undefined' && bolts.length > 50) addBug('warning', 'Память', `Утечка молний: ${bolts.length} шт.`);
          if (typeof trees !== 'undefined' && trees.length > 600) addBug('info', 'Память', `Слишком много деревьев: ${trees.length} (лимит 500)`);

          // --- ПРОВЕРКА КАМЕРЫ И ИНТЕРФЕЙСА ---
          if (typeof zoom !== 'undefined' && (zoom <= 0.05 || zoom > 5)) addBug('critical', 'Интерфейс', `Сломан зум: ${zoom} (игра станет невидимой)`);
          if (typeof camX !== 'undefined' && !isFinite(camX)) addBug('critical', 'Интерфейс', `Координата камеры X сломалась (NaN)`);
          if (typeof camY !== 'undefined' && !isFinite(camY)) addBug('critical', 'Интерфейс', `Координата камеры Y сломалась (NaN)`);

        } catch(e) {}
      }, 1000);
    });

    console.log('Тестируем 5 минут...');
    await new Promise(r => setTimeout(r, 300000)); 

    console.log('Сбор данных...');
    const foundBugs = await page.evaluate(() => window.__ALL_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    bugs.push({ sev: 'critical', cat: 'Робот', msg: 'Ошибка запуска: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  let bugs = [];
  try {
    console.log('Скачиваем исходный код напрямую с GitHub...');
    // Скачиваем файл напрямую из репозитория
    const rawRes = await fetch('https://raw.githubusercontent.com/w86mwzd9kg-boop/kubiya/main/index.html');
    const html = await rawRes.text();

    // --- СТАТИЧЕСКИЙ АНАЛИЗ (100% надежный) ---
    if (html.includes('a.isExposed')) {
      bugs.push({ sev: 'critical', cat: 'Код', msg: 'hostile(): проверяется a.isExposed вместо b.isExposed (предателей нельзя убить)' });
    }
    if (/\?\s*999\s*:\s*150/.test(html) || html.includes('999 : 150')) {
      bugs.push({ sev: 'warning', cat: 'Код', msg: 'Урон Божественной Кары (999) не убивает медведя на "Безумии"' });
    }

    bugs.push({ sev: 'info', cat: 'Система', msg: 'Исходный код успешно прочитан и проверен' });

    // Сохраняем статические баги сразу
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));

    // --- ДИНАМИЧЕСКИЙ АНАЛИЗ (Проверка в бою) ---
    console.log('Запускаем игру для динамического теста...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();

    await page.goto('https://w86mwzd9kg-boop.github.io/kubiya/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.evaluate(() => {
      window.__CLOUD_BUGS__ = [];
      const addBug = (sev, cat, msg) => {
        if (!window.__CLOUD_BUGS__.some(b => b.msg === msg)) {
          window.__CLOUD_BUGS__.push({ sev, cat, msg });
        }
      };

      // Принудительный старт
      try {
        if (typeof generateWorld === 'function') generateWorld();
        if (typeof createKingdoms === 'function') createKingdoms();
        if (typeof appState !== 'undefined') appState = 'playing';
      } catch(e) {}

      // Стресс-тест
      setInterval(() => {
        try {
          if (typeof speedMult !== 'undefined') speedMult = 3;
          if (typeof strikeBolt === 'function' && Math.random() > 0.3) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, 'divine');
          if (typeof makeBeing === 'function' && Math.random() > 0.5) makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, 'traitor', false, null);
        } catch(e) {}
      }, 800);

      // Глубокие проверки
      setInterval(() => {
        try {
          if (typeof appState !== 'undefined' && appState !== 'playing') return;
          
          // Проверка на мертвых и сломанных
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            for (let u of beings) {
              if (!u) continue;
              if (u.hp <= 0) addBug('warning', 'Логика', `Мертвое существо (${u.type}) осталось на карте (HP: ${u.hp})`);
              if (!isFinite(u.x) || !isFinite(u.y)) addBug('critical', 'Координаты', `Существо (${u.type}) имеет сломанные координаты (NaN)`);
            }
          }

          // ПРИНУДИТЕЛЬНАЯ ПРОВЕРКА ПРЕДАТЕЛЯ (Прямой вызов функции)
          if (typeof hostile === 'function' && typeof beings !== 'undefined') {
            let traitor = beings.find(b => b.type === 'traitor');
            let human = beings.find(b => b.type === 'human');
            if (traitor && human) {
              traitor.isExposed = true; // Принудительно раскрываем
              if (!hostile(human, traitor)) {
                addBug('critical', 'Логика', 'Баг подтвержден в бою: жители НЕ атакуют раскрытого предателя!');
              }
            }
          }

          if (typeof wood !== 'undefined' && wood[0] < 0) addBug('critical', 'Ресурсы', `Дерево ушло в минус: ${wood[0]}`);
          if (typeof zoom !== 'undefined' && (zoom <= 0.05 || !isFinite(zoom))) addBug('critical', 'Интерфейс', `Сломан зум: ${zoom}`);
        } catch(e) {}
      }, 1000);
    });

    console.log('Ждем 5 минут...');
    await new Promise(r => setTimeout(r, 300000)); 

    const foundBugs = await page.evaluate(() => window.__CLOUD_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    bugs.push({ sev: 'critical', cat: 'Робот', msg: 'Ошибка скрипта: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

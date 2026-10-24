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

    // --- СТАТИЧЕСКИЙ АНАЛИЗ (Проверка текста) ---
    console.log('Проверка кода...');
    if (html.includes('a.isExposed')) {
      bugs.push({ sev: 'critical', cat: 'Код', msg: 'hostile(): проверяется a.isExposed вместо b.isExposed (предателей нельзя убить)' });
    }
    if (html.includes('999 : 150')) {
      bugs.push({ sev: 'warning', cat: 'Код', msg: 'Урон Божественной Кары (999) не убивает медведя на "Безумии"' });
    }

    // Добавляем тестовый баг, чтобы ты точно знал, что робот работает
    bugs.push({ sev: 'info', cat: 'Система', msg: 'Робот успешно запустился и приступил к тестированию' });

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));

    // --- ДИНАМИЧЕСКИЙ АНАЛИЗ ---
    console.log('Принудительный запуск игры...');
    await page.evaluate(() => {
      window.__CLOUD_BUGS__ = [];
      const addBug = (sev, cat, msg) => {
        if (!window.__CLOUD_BUGS__.some(b => b.msg === msg)) {
          window.__CLOUD_BUGS__.push({ sev, cat, msg });
        }
      };

      // ПРИНУДИТЕЛЬНО ЗАПУСКАЕМ ИГРУ (обходя главное меню)
      try {
        if (typeof generateWorld === 'function') generateWorld();
        if (typeof createKingdoms === 'function') createKingdoms();
        if (typeof appState !== 'undefined') appState = 'playing';
        if (typeof recalcView === 'function') recalcView();
      } catch(e) {}

      // Стресс-тест: бьем молниями и спавним монстров
      setInterval(() => {
        try {
          if (typeof speedMult !== 'undefined') speedMult = 3;
          if (typeof strikeBolt === 'function' && Math.random() > 0.3) strikeBolt(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.random() > 0.5 ? 'divine' : 'normal');
          if (typeof makeBeing === 'function' && Math.random() > 0.5) makeBeing(Math.random() * WORLD_W, Math.random() * WORLD_H, 'traitor', false, null);
        } catch(e) {}
      }, 800);

      // Проверки
      setInterval(() => {
        try {
          if (typeof appState !== 'undefined' && appState !== 'playing') return;
          
          if (typeof beings !== 'undefined' && Array.isArray(beings)) {
            for (let u of beings) {
              if (!u) continue;
              if (u.hp <= 0) addBug('warning', 'Логика', `Мертвое существо (${u.type}) осталось на карте (HP: ${u.hp})`);
              if (!isFinite(u.x) || !isFinite(u.y)) addBug('critical', 'Координаты', `Существо (${u.type}) имеет сломанные координаты (NaN)`);
            }
          }
          if (typeof wood !== 'undefined' && wood[0] < 0) addBug('critical', 'Ресурсы', `Дерево ушло в минус: ${wood[0]}`);
          if (typeof zoom !== 'undefined' && (zoom <= 0.05 || !isFinite(zoom))) addBug('critical', 'Интерфейс', `Сломан зум: ${zoom}`);
        } catch(e) {}
      }, 1000);
    });

    console.log('Ждем 5 минут...');
    await new Promise(r => setTimeout(r, 300000)); 

    console.log('Сбор данных...');
    const foundBugs = await page.evaluate(() => window.__CLOUD_BUGS__);
    bugs = bugs.concat(foundBugs);

    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
    await browser.close();

  } catch (err) {
    bugs.push({ sev: 'critical', cat: 'Робот', msg: 'Ошибка скрипта: ' + err.message });
    fs.writeFileSync('bugs.json', JSON.stringify(bugs, null, 2));
  }
})();

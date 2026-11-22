# Инструменты для приложения

- `extract.sh` — вынуть скрипт из `../gym.html` в `g.js` и проверить синтаксис (`node --check`).
- `t16.js` — симуляция «всё по плану»: `node t16.js 23` (сводка по всем упражнениям, ⚠ = волна не выше прошлой), `node t16.js 23 d1_pendx,d2_incl` — подробно по упражнениям. Нужен свежий `g.js` (сначала `./extract.sh`).
- `build_demo.py` — собрать тестовую страницу `../gym-demo.html` из `../gym.html` (сценарии «Всё по плану / Реально / С изменениями»): `python3 build_demo.py`.

Публикация (из сессии Claude): Artifact tool, `file_path` = `/Users/user/fitness/gym.html` и **`url` = https://claude.ai/artifact/7UNhqCFEvJ7uvdUqnMpwJo** (без url создастся новая страница); тест — `gym-demo.html` с url https://claude.ai/artifact/WH69xYDVP4LgeENhNSjsM9. Перед публикацией в новой сессии артефакт нужно прочитать (Artifact action=read с url).
- `next.js` — что приложение предложит в следующий раз по реальным записям из `db/` (выгрузка базы: sessions, settings, body): `node next.js '[["2","2026-10-21",2]]'` (день, дата, микроцикл). Нужен свежий `g.js`.

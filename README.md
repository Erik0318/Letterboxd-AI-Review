## Contents / Зміст

* [English](#letterboxd-ai-review)
* [Українська](#letterboxd-ai-review-українською)

# Letterboxd AI Review

A no login web app that analyses your Letterboxd export ZIP locally, generates rich stats and charts, and produces an AI roast or praise based on the merged dataset.

## Live site

* Production: https://erikdev.cc

## What this project does

Letterboxd exports include multiple CSV files such as watched.csv, ratings.csv, diary.csv, reviews.csv, and more. This app parses the ZIP in the browser, merges everything into a single master film table, then provides:

* Core watched and rated statistics
* Activity and distribution charts
* Shareable summary text and a share card image export
* AI commentary in roast or praise modes
* A debug panel to inspect merge quality and anomalies

## Features

### 1) Import options

* Upload your own Letterboxd ZIP.
* Click Use sample_data.zip to load the official sample from /sample_data.zip (public/sample_data.zip) using the exact same import pipeline.

### 2) CSV parsing and merge rules

Top level CSVs recognised when present:

* watched.csv
* ratings.csv
* reviews.csv
* diary.csv
* watchlist.csv
* profile.csv
* comments.csv

Current merge behaviour:

* watched.csv sets the watched baseline with watched=true
* ratings.csv writes rating fields
* reviews.csv writes review text fields
* diary.csv provides the watch timeline. watched_at is preferred, with fallback to logged date. It also provides rewatch and tags
* comments.csv is not treated as reviews

Films missing from watched but present in ratings, reviews, or diary are merged into the master table and surfaced in the debug summary.

### 3) Visualisations and stats

After import, the app shows:

* Watched and rated totals
* Mean and median rating
* Longest streak
* Monthly activity heatmap
* Rating histogram
* Release year and decade distributions
* Text frequency and a few style indices

### 4) AI output

Supports roast and praise modes and intensity levels. Default backend is DeepSeek, with optional OpenAI compatible or Gemini settings in the UI.

AI input is generated from:

* Merged master film data
* Computed stats and distributions
* A compact profile payload that reflects merge diagnostics and anomalies

### 5) Debug summary

A toggleable debug panel shows merge diagnostics such as:

* Detected CSV list
* Merged film totals
* watched=true count
* Watched date coverage
* Ratings and reviews hit rates
* only in ratings and only in reviews counts
* Import spike metrics, including the largest single day import count and date
* Sampled films with field and source presence

This exists to confirm you are looking at a real merged dataset, not single file stats.

## Tech stack

* Frontend: React + TypeScript + Vite
* CSV and ZIP: PapaParse + JSZip
* Share card export: html2canvas
* Serverless API: Cloudflare Pages Functions at /api/ai

## Local development

```bash
npm install
npm run dev
```

Vite provides the dev server.

## Production build

Sample self check:

```bash
npm run verify:sample
```

Build and preview:

```bash
npm run build
npm run preview
```

## Sample verification

Official sample data is included at:

* public/sample_data.zip

Run verification:

```bash
npm run verify:sample
```

This command loads the sample ZIP, runs parser and merge, prints the debug summary, and validates key constraints.

## Cloudflare Pages deployment

* Build command: npm run build
* Output directory: dist

Recommended production env for DeepSeek:

* OPENAI_API_KEY as a secret
* OPENAI_BASE_URL=https://api.deepseek.com  without /v1
* OPENAI_MODEL=deepseek-chat  or deepseek-reasoner

Optional Gemini fallback:

* GEMINI_API_KEY
* GEMINI_MODEL

Rate limit and bypass options:

* AI_DAILY_LIMIT=2
* Bind a KV namespace to RLKV
* Optional AI_BYPASS_IPS as comma separated values

## Privacy

* Parsing and stat calculations run in the browser
* No login, no user database, refresh clears local state
* AI calls send a generated profile and stats payload to /api/ai on your own deployment



# Letterboxd AI Review українською

Вебзастосунок без логіну, який локально аналізує ZIP експорт Letterboxd, будує детальну статистику та графіки, а також генерує AI коментар у режимі roast або praise на основі об’єднаних даних.

## Живий сайт

* Продакшн: https://erikdev.cc

## Що робить цей проєкт

Експорт Letterboxd містить кілька CSV файлів, наприклад watched.csv, ratings.csv, diary.csv, reviews.csv та інші. Цей застосунок розбирає ZIP у браузері, об’єднує все в одну головну таблицю фільмів, і показує:

* Базову статистику переглядів і оцінок
* Графіки активності та розподілів
* Текстовий підсумок для копіювання та експорт картки для поширення
* AI коментар у режимах roast або praise
* Debug панель для перевірки якості об’єднання та пошуку аномалій

## Функції

### 1) Імпорт

* Завантаження власного ZIP експорту Letterboxd
* Кнопка Use sample_data.zip, яка завантажує офіційний приклад з /sample_data.zip (public/sample_data.zip) через той самий пайплайн імпорту

### 2) Розбір CSV та правила об’єднання

CSV файли верхнього рівня, які розпізнаються, якщо присутні:

* watched.csv
* ratings.csv
* reviews.csv
* diary.csv
* watchlist.csv
* profile.csv
* comments.csv

Поточна логіка об’єднання:

* watched.csv задає базову ознаку watched=true
* ratings.csv записує поля оцінки
* reviews.csv записує поля тексту рецензії
* diary.csv формує часову лінію переглядів. Пріоритет має watched_at, якщо його немає, використовується logged date. Також додаються rewatch і теги
* comments.csv не вважається reviews

Фільми, яких немає у watched, але які є у ratings, reviews або diary, додаються до master таблиці та відображаються в debug summary.

### 3) Візуалізації та статистика

Після імпорту застосунок показує:

* Загальну кількість переглянутих і оцінених
* Середню та медіанну оцінку
* Найдовший streak
* Місячну теплову мапу активності
* Гістограму оцінок
* Розподіли за роком і десятиліттям релізу
* Частоти тексту та кілька індексів стилю

### 4) AI результат

Підтримуються режими roast і praise та рівні інтенсивності. За замовчуванням бекенд це DeepSeek, також є налаштування сумісних OpenAI провайдерів або Gemini у UI.

AI вхід генерується з:

* Об’єднаних даних master таблиці фільмів
* Обчисленої статистики та розподілів
* Компактного профільного payload, який враховує діагностику об’єднання та аномалії

### 5) Debug summary

Перемикаюча debug панель показує діагностику об’єднання, наприклад:

* Список знайдених CSV
* Загальні підсумки по master таблиці
* Кількість watched=true
* Покриття дат перегляду
* Відсоток збігів для ratings і reviews
* Кількість only in ratings та only in reviews
* Метрики import spike, включно з найбільшим імпортом за один день і датою
* Випадкові приклади фільмів з позначенням, з яких джерел і полів вони зібрані

Це потрібно, щоб швидко перевірити, що статистика базується на реальному об’єднанні, а не на одній таблиці.

## Технології

* Frontend: React + TypeScript + Vite
* CSV та ZIP: PapaParse + JSZip
* Експорт картки: html2canvas
* Serverless API: Cloudflare Pages Functions за шляхом /api/ai

## Локальна розробка

```bash
npm install
npm run dev
```

Dev сервер надає Vite.

## Продакшн збірка

Самоперевірка на прикладі:

```bash
npm run verify:sample
```

Збірка та перегляд:

```bash
npm run build
npm run preview
```

## Перевірка sample

Офіційний sample включено тут:

* public/sample_data.zip

Запуск перевірки:

```bash
npm run verify:sample
```

Команда завантажує sample ZIP, запускає розбір і об’єднання, друкує debug summary та перевіряє ключові обмеження.

## Деплой на Cloudflare Pages

* Команда збірки: npm run build
* Каталог виходу: dist

Рекомендовані змінні середовища для DeepSeek:

* OPENAI_API_KEY як secret
* OPENAI_BASE_URL=https://api.deepseek.com  без /v1
* OPENAI_MODEL=deepseek-chat  або deepseek-reasoner

Опційний fallback на Gemini:

* GEMINI_API_KEY
* GEMINI_MODEL

Опції ліміту та обходу:

* AI_DAILY_LIMIT=2
* Прив’язати KV namespace до RLKV
* Опційно AI_BYPASS_IPS як список через кому

## Приватність

* Розбір і обчислення статистики виконуються в браузері
* Немає логіну, немає бази користувачів, оновлення сторінки очищає локальний стан
* AI запити надсилають згенерований payload профілю і статистики на /api/ai у вашому деплої

Dukascopy proxy
================

This tiny backend proxies calls to `dukascopy-node` so the frontend can fetch historical data without trying to load a Node-only package in the browser.

Quick start
-----------

1. Install dependencies:

```bash
cd Backend
npm install
```

2. Copy the example env and change port if desired:

```bash
cp .env.example .env
```

3. Start the server:

```bash
npm start
```

By default the server listens on port 3001 and exposes:

- GET /api/dukascopy/historical?instrument=EURUSD&from=YYYY-MM-DD&to=YYYY-MM-DD&timeframe=m1

It returns the raw JSON that `dukascopy-node` produces.

Security note
-------------
This is a development helper. For production you should add authentication, rate-limiting and input validation.

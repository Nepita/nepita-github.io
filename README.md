# Bau-Ausschreibungen Dashboard

Statisches Dashboard fuer Bauausschreibungen mit lokalen Daten in `data.js`.

## Lokal oeffnen

Oeffne `index.html` im Browser.

## Daten aktualisieren

```bash
node scripts/update-tenders.mjs
```

Das Script liest den RSS-Feed von service.bund.de, filtert offene Bau-Treffer und aktualisiert `data.js`.

Details stehen in `DEPLOY-UPDATES.md`.

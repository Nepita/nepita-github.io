# Dashboard automatisch aktualisieren

Dieses Dashboard ist statisch. Das Update-Script aktualisiert deshalb `data.js` und baut danach eine neue ZIP-Datei fuer Netlify Drop.

## Manuell aktualisieren

```bash
cd /Users/adrianoatipeta/.openclaw/workspace/bau-ausschreibungen-dashboard
node scripts/update-tenders.mjs
```

Danach liegt die neue ZIP hier:

```text
/Users/adrianoatipeta/Desktop/bau-ausschreibungen-dashboard-deploy.zip
```

Diese ZIP kannst du wieder bei Netlify Drop hochladen:

```text
https://app.netlify.com/drop
```

## Taeglich lokal laufen lassen

Mit `cron` z. B. jeden Morgen um 07:30:

```cron
30 7 * * * /Users/adrianoatipeta/.openclaw/workspace/bau-ausschreibungen-dashboard/scripts/update-daily.sh >> /Users/adrianoatipeta/.openclaw/workspace/bau-ausschreibungen-dashboard/update.log 2>&1
```

Das aktualisiert lokal die Dateien und die ZIP. Fuer automatische Aktualisierung der oeffentlichen Webseite brauchst du zusaetzlich GitHub/Netlify oder einen Netlify Deploy Hook.

## Automatischer Deploy mit Netlify Deploy Hook

Wenn Netlify dir einen Deploy Hook gibt, kann das Script ihn ausloesen:

```bash
export NETLIFY_DEPLOY_HOOK="https://api.netlify.com/build_hooks/DEIN_HOOK"
node scripts/update-tenders.mjs
```

Noch besser: Dashboard in ein GitHub-Repo legen, Netlify mit GitHub verbinden und das taegliche Script in GitHub Actions laufen lassen. Dann wird die Webseite wirklich automatisch neu gebaut.

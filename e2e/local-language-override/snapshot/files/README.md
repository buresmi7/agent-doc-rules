# Faktury CLI

Faktury CLI ověřuje CSV soubory s fakturami před importem do účetního systému.
Balíček se jmenuje `faktury-cli` a je soukromý.

## Rychlý start

Spusť testy:

```bash
npm test
```

Příkaz používá `node --test`.

## Kanonické dokumenty

| Dokument | Obsah |
| --- | --- |
| `README.md` | Přehled projektu a základní ověření pro lidi. |
| `AGENTS.md` | Místní pravidla pro agenty a ověřovací pokyny. |
| `package.json` | Název balíčku, typ modulu, skripty a závislosti. |

## Dokumentace

Pravidla pro agenty a místní pravidla dokumentace jsou v `AGENTS.md`.
Při psaní příkladů nepoužívej skutečná jména dodavatelů, čísla faktur ani
 daňová identifikační čísla.

## Ověření

Před změnou validačního chování spusť:

```bash
npm test
```

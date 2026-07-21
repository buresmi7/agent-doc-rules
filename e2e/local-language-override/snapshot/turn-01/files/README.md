# Faktury CLI

Faktury CLI ověřuje CSV soubory s fakturami před jejich importem do účetního
systému. Tento repozitář zatím obsahuje projektový manifest a pravidla pro
dokumentaci; konkrétní příkaz CLI není v repozitáři doložený, proto zde není
uvedený.

## Kanonické dokumenty

| Dokument | Obsah |
| --- | --- |
| `README.md` | Přehled projektu a základní ověření |
| `AGENTS.md` | Pravidla pro agenty, lokální jazykové nastavení a bezpečnostní hranice |
| `project-notes.md` | Ukazatel na kanonické dokumenty po přesunu původních poznámek |

## Ověření

Před změnou validačního chování spusťte testy z kořene repozitáře:

```sh
npm test
```

Tento příkaz odpovídá skriptu `test` v `package.json`.

## Bezpečnost dokumentace

Do dokumentace a příkladů nevkládejte skutečné názvy dodavatelů, čísla faktur
ani daňová identifikační čísla. Používejte anonymizované nebo smyšlené hodnoty.

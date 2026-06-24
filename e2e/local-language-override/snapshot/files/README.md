# Faktury CLI

Faktury CLI ověřuje CSV soubory s fakturami před jejich importem do účetního
systému.

## První užitečný krok

Spusťte testy z kořene repozitáře:

```sh
npm test
```

## Kanonické dokumenty

| Dokument | Obsah |
| --- | --- |
| `README.md` | Přehled projektu a základní příkaz pro ověření |
| `AGENTS.md` | Místní pravidla pro agenty a ověřování |
| `package.json` | Zdroj pravdy pro dostupné npm skripty |

Pokud se dokumenty liší v dostupných příkazech, platí `package.json`.

## Bezpečnost dat

Do dokumentace, příkladů ani vygenerovaných fixture dat nevkládejte skutečné
názvy dodavatelů, čísla faktur ani daňová identifikační čísla.

## Ověření změn

Před změnou validačního chování spusťte:

```sh
npm test
```

Repozitář nemá samostatný skript pro kontrolu dokumentace. U změn dokumentace
zkontrolujte Markdown ručně a uveďte důvod i zbývající riziko, pokud nelze
relevantní kontrolu spustit.

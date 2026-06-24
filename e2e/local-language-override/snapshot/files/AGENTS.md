# Faktury CLI - pokyny pro agenty

Faktury CLI ověřuje CSV soubory s fakturami před importem do účetního systému.

## Sdílená pravidla

- [Pravidla pro `AGENTS.md`](.agents/skills/agent-doc-rules/references/agents-md.md)

## Místní pravidla

- Trvalá dokumentace projektu se píše standardní češtinou s českou diakritikou.
- Názvy příkazů, cest k souborům a balíčků ponechte beze změny.
- Do dokumentace ani příkladů nevkládejte skutečné názvy dodavatelů, čísla
  faktur ani daňová identifikační čísla.

## Zdroj pravdy

- `README.md` obsahuje přehled projektu a základní ověřovací příkaz.
- `package.json` je zdroj pravdy pro dostupné npm skripty.

## Ověření

- Před změnou validačního chování spusťte `npm test`.
- Pro změny dokumentace není v `package.json` samostatný kontrolní skript.
- Pokud kontrolu nelze spustit, uveďte důvod a zbývající riziko.

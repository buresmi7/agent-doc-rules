# Faktury CLI - pokyny pro agenty

Faktury CLI ověřuje CSV soubory s fakturami před importem do účetního systému.

## Sdílená pravidla

- [Pravidla pro `AGENTS.md`](.agents/skills/agent-doc-rules/references/agents-md.md)

## Místní pravidla

- Trvalou dokumentaci piš spisovnou češtinou se správnou českou diakritikou.
- Názvy příkazů, cest k souborům a balíčků ponechávej beze změny.
- Do dokumentace ani příkladů nevkládej skutečná jména dodavatelů, čísla faktur
  ani daňová identifikační čísla.
- Dlouhé postupy patří do `README.md` nebo do budoucích souborů v `docs/`.

## Zdroj pravdy

- `README.md` je vstupní dokument pro lidské přispěvatele.
- `AGENTS.md` obsahuje místní pravidla pro agenty.
- `package.json` je zdroj pravdy pro název balíčku, skripty a závislosti.

## Ověření

- Před změnou validačního chování spusť `npm test`.
- Pokud kontrolu nelze spustit, uveď důvod a zbytkové riziko v závěrečné
  poznámce.

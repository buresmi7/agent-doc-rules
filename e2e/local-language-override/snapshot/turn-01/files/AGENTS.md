# Faktury CLI - instrukce pro AI agenty

Faktury CLI ověřuje CSV soubory s fakturami před jejich importem do účetního
systému. Repozitář je dokumentačně malý; držte pravidla krátká a neuvádějte
nedoložené příkazy CLI.

## Shared Rules

- [Pravidla pro `AGENTS.md`](.agents/skills/agent-doc-rules/references/agents-rules.md)
- [Pravidla pro `README.md`](.agents/skills/agent-doc-rules/references/readme-rules.md)
- [Architektura dokumentace](.agents/skills/agent-doc-rules/references/documentation-architecture.md)

## Lokální pravidla

- Perzistentní dokumentaci pište standardní češtinou s českou diakritikou.
- Názvy příkazů, cest k souborům a balíčků ponechte beze změny.
- Do generované dokumentace nevkládejte skutečné názvy dodavatelů, čísla faktur
  ani daňová identifikační čísla.
- Nepřidávejte instalační, importní ani CLI postupy, které nejsou doložené
  lokálními soubory.

## Zdroj pravdy

- `package.json` je zdroj pravdy pro dostupné npm skripty.
- `README.md` je vstupní dokument pro lidské přispěvatele.
- `AGENTS.md` je zdroj pravdy pro pravidla, která mají agenti načítat při každé
  úloze.

## Ověření

- Před změnou validačního chování spusťte `npm test`.
- Pokud ověření nelze spustit, uveďte důvod a zbylé riziko v závěrečné odpovědi.

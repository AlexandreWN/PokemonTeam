# Montador de Time Pokémon — Cobbleverse

App local (HTML + JS + um servidor Node minúsculo) para buscar Pokémon, montar um time de até 6
e guardar o histórico em arquivos `.txt` na pasta `times/`. Sem banco de dados, sem dependências.

## Como rodar

Duplo-clique em **`iniciar.bat`** (ou, no terminal, `node server.js`) e abra:

    http://localhost:5173

Para parar: feche a janela do terminal ou aperte `Ctrl + C`.

## O que dá pra fazer

- **Buscar** qualquer Pokémon pelo nome (autocomplete com a lista completa da PokeAPI, incluindo
  formas regionais tipo `ninetales-alola`).
- Ver **tipos, stats base (BST), habilidades e a linha evolutiva** com o método de evolução
  (nível, pedra, amizade, troca — anotada como *Linking Cord* no Cobblemon).
- **Sugerir set (Smogon)**: puxa um set competitivo real (nature, habilidade, item, EVs e os 4
  golpes) como ponto de partida. As opções alternativas do set viram botõezinhos clicáveis.
- Editar tudo à mão: nature, habilidade, item (com nota de efeito), EVs (com total /508) e os
  4 golpes — o seletor de golpe só mostra os que aquele Pokémon realmente aprende.
- Escrever **Papel** e **Trocas** em texto livre para cada Pokémon.
- **Salvar time** com um nome → vira `times/<nome>.txt`.
- **Histórico** → lista os times salvos, com **Carregar** (repopula tudo) e **Excluir**.

## Onde ficam os times

Na pasta `times/`, um `.txt` por time — legível e editável em qualquer editor de texto.
Pode copiar, versionar ou mandar pra alguém. O app lê o mesmo formato de volta.

## Fontes de dados

- [PokeAPI](https://pokeapi.co/) — espécies, tipos, stats, habilidades, golpes e evoluções.
- [data.pkmn.cc](https://data.pkmn.cc/) (Smogon) — sets competitivos sugeridos.

> Nenhuma das duas conhece as particularidades do Cobbleverse/Cobblemon (formas exclusivas,
> mudanças de evolução, disponibilidade de itens no modpack). Trate as sugestões como ponto de
> partida e ajuste conforme a sua run.

## Arquivos

    server.js        servidor local (Node puro): serve o app e grava/lê os .txt
    public/          index.html, style.css, app.js — a interface
    times/           seus times salvos (.txt)
    iniciar.bat      atalho pra subir o app no Windows

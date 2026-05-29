# Note per agenti

## Obiettivo del progetto

Creare una web app statica, single page, per sostituire un gioco PowerPoint con macro sulla respirazione cellulare usato in classe.

## Scelte tecniche

- Framework: SvelteKit con TypeScript.
- Target di deploy: GitHub Pages tramite `@sveltejs/adapter-static`.
- Il base path resta vuoto in locale. Il workflow Pages passa `BASE_PATH=/respirazione-cellulare` durante la build di produzione.
- La logica del gioco sta in `src/lib/game.ts` ed e coperta da test in `src/lib/game.test.ts`.

## Vincoli didattici

- Il gioco deve supportare un numero configurabile di squadre, attualmente da 2 a 8.
- I pulsanti degli step devono restare selezionabili anche quando lo step non e possibile: e parte della dinamica del gioco capire se i reagenti sono disponibili.
- Dopo ogni mossa, valida o non valida, il turno passa alla squadra successiva.
- Non rivelare in anticipo quali step sono disponibili, salvo eventuali modalita di aiuto future esplicitamente richieste.

## Logica recuperata dal PowerPoint

La macro VBA originale e stata letta dal file `gioco respirazione cellulare v2.pptm`.

Stato iniziale:

- `ExtGlucose = 1`
- `CytADP = 2`, `CytNAD = 2`
- `MitADP = 30`, `MitNAD = 10`, `MitFAD = 2`
- `MitH = 120`, `IntH = 120`

Step e punteggi:

- `ImportaGlucosio`: richiede glucosio esterno, +1.
- `Glicolisi`: richiede glucosio, 2 ADP e 2 NAD+ nel citoplasma, +3.
- `ImportaAcidoPiruvico`: richiede piruvato nel citoplasma, +1.
- `ImportaNADH`: richiede NADH nel citoplasma e NAD+ nella matrice, +1.
- `Krebs`: richiede piruvato, ADP, 4 NAD+ e FAD nella matrice, +2.
- `ETC`: usa prima 2 NADH e 20 H+ in matrice, altrimenti 2 FADH2 e 12 H+ in matrice, +1.
- `ATPSynthase`: richiede `IntH - MitH > 7` e ADP in matrice, +2.
- Se lo step fallisce, la squadra attiva perde 1 punto.

## Stile dell'app

- L'app deve restare una plancia di gioco, non una landing page.
- La grafica deve rendere leggibili compartimenti, reagenti, prodotti e punteggi su schermo da aula.
- Evitare di disabilitare gli step in base allo stato, per non togliere la scelta agli studenti.

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
- La grafica principale e una plancia SVG full-screen: mantenere molecole e azioni dentro lo schema della cellula, non in pannelli laterali persistenti.
- Reagenti e prodotti vanno mostrati come icone, senza contatori numerici accanto alle icone. I coefficienti numerici sono invece ammessi nella reazione complessiva.
- La grafica deve rendere leggibili compartimenti, reagenti, prodotti e punteggi su schermo da aula.
- Evitare di disabilitare gli step in base allo stato, per non togliere la scelta agli studenti.

## Indicazioni layout plancia

- I pulsanti devono stare nel compartimento o sulla membrana biologicamente corretta. In particolare `Catena di trasporto` e `ATP sintasi` devono essere sulla membrana interna del mitocondrio, non sulla membrana esterna.
- Le icone dello stesso tipo possono sovrapporsi parzialmente, come una mano/scaletta di carte, per mostrare abbondanza senza occupare troppo spazio. Evitare sovrapposizione perfetta fra icone oltre il limite visibile.
- Icone di tipo diverso dovrebbero restare separate per quanto possibile; verificare con Playwright screenshot e bounding box quando si spostano gruppi di molecole.
- I protoni non devono essere rappresentati come icone grandi con testo `H+`. Usare due campi curvi affiancati di dimensioni simili, uno nella matrice e uno nello spazio intermembrana, con piccoli puntini rossi randomizzati e animati con oscillazione leggera.
- I campi protonici devono seguire il disegno delle membrane mitocondriali: il campo intermembrana deve sovrapporsi a un tratto dello spazio tra membrana interna ed esterna, mentre quello della matrice deve essergli adiacente all'interno della matrice. Preferire forme a settore/segmento curvo, non rettangoli.
- I campi protonici non devono occupare tutta la matrice o tutto lo spazio intermembrana: tenerli sul lato destro, vicino a `Catena di trasporto` e `ATP sintasi`.
- Il feedback temporaneo deve bloccare i click sulla plancia sottostante. Un click mentre il feedback e visibile deve chiudere solo il feedback, senza attivare azioni.
- Il feedback usa verde per successo e rosso per fallimento; il colore della squadra puo comparire come accento secondario, ad esempio sul nome della squadra.

# Respirazione cellulare

Web app statica single page per giocare in classe con gli step della respirazione cellulare.

Gli studenti giocano a squadre. A ogni turno la squadra attiva sceglie uno step: se i reagenti necessari sono disponibili nel compartimento corretto, ottiene i punti previsti; se lo step non puo essere svolto, perde 1 punto. La prima bozza riproduce la logica del vecchio PowerPoint con macro e aggiunge la scelta del numero di squadre.

## Stack

- SvelteKit + TypeScript
- `@sveltejs/adapter-static` per esportazione statica
- Vitest per i test della logica di gioco
- GitHub Actions per pubblicazione su GitHub Pages

## Sviluppo locale

```bash
npm install
npm run dev
```

Comandi utili:

```bash
npm run check
npm test
npm run build
npm run preview
```

## GitHub Pages

Il workflow e configurato per pubblicare come Project Page, quindi con base path `/respirazione-cellulare`. In sviluppo locale il base path resta vuoto.

Per pubblicare:

1. creare un repository GitHub chiamato `respirazione-cellulare`;
2. fare push del branch `main`;
3. nelle impostazioni del repository abilitare Pages da GitHub Actions.

Il workflow `.github/workflows/deploy.yml` installa le dipendenze, esegue type-check e test, genera la build statica e la distribuisce su Pages.

## Regole derivate dal PowerPoint

Stato iniziale:

- esterno: 1 glucosio;
- citoplasma: 2 ADP, 2 NAD+;
- matrice mitocondriale: 30 ADP, 10 NAD+, 2 FAD;
- protoni: 120 in matrice e 120 nello spazio intermembrana.

Punteggi:

- Importa glucosio: +1;
- Glicolisi: +3;
- Importa acido piruvico: +1;
- Importa NADH: +1;
- Ciclo di Krebs: +2;
- Catena di trasporto: +1;
- ATP sintasi: +2;
- mossa non valida: -1.

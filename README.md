# Pair Pals Memory

A pass-and-play memory card game for iPhone and iPad. Flip two cards, find a pair, keep your turn, and see who finds the most pairs.

![Pair Pals icon](icons/icon-192.png)

## What you can change

| Setting | Options |
| --- | --- |
| Players | Solo, or 2 to 6 players. Each player picks a name and a face. |
| Pictures | Animals, Fruit & veg, Yummy treats, Things that go, Under the sea, Space & sky, Garden & bugs, Sports & play, Silly faces, Mix of everything, or **My own pictures** |
| My own pictures | Type or paste emojis, letters or short words (`🦖 🍕 Mum Dad A B C`), and add photos from your camera roll. If you have fewer than the game needs, the rest come from Mix of everything. |
| Cards | 8, 12, 16, 20, 24, 30, 36 or 48 (4 to 24 pairs) |
| House rules | Find a pair, go again (on by default). Sneak peek: show every card for 3 seconds at the start. |

## How scores work

- The scoreboard shows how many pairs each player has, plus the pictures they found.
- Matched cards stay on the table with a ring and badge in the colour of the player who found them.
- The table glows in the colour of whoever's turn it is, and a banner says whose turn is next.
- At the end you get a ranking. Ties share a place. Solo games track moves and time, and remember your best for each setup.
- Your setup and any game in progress are saved on the device, so closing the tab doesn't lose a game.

## Playing on iPhone or iPad

The whole game is one file, `index.html`, with no build step. It lays itself out for whatever screen it's on: scores above the cards in portrait, a side rail in landscape, and the card grid sized to fill the space.

To install it like an app:

1. Host the folder somewhere with HTTPS. GitHub Pages works: in the repository, open **Settings → Pages**, pick the branch and the root folder, and save.
2. Open the page in Safari on the iPhone or iPad.
3. Tap **Share → Add to Home Screen**.

It then opens full screen with its own icon. A small service worker (`sw.js`) keeps a copy of the game, so after the first visit it also opens without a connection (the web fonts fall back to the system rounded font when offline).

To try it on a computer, run `npm start` and open the address it prints, or just open `index.html` in a browser.

## Tests

```sh
npm install
npm test
```

The tests use Playwright's Chromium to deal games at iPhone SE, iPhone 15, iPhone 15 Pro Max, iPad mini, iPad Air and iPad Pro sizes in both orientations, checking that nothing overflows and every card fits on the table. They also play whole games to check turns, scores, ties, solo results, saved games and custom pictures.

## Files

- `index.html`: the game (markup, styles and script)
- `manifest.webmanifest` and `icons/`: home-screen install
- `tests/e2e.mjs`: end-to-end checks

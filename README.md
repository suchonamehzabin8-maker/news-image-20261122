[![make.fun · news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/suchonamehzabin8-maker/news-image-20261122/rank.svg)](https://make.fun/bounty/news-image-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/suchonamehzabin8-maker/news-image-20261122/reward.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)

# The World in One Day — Sunday 22 November 2026

A newspaper front page drawn entirely from code, summing up the world's news of Sunday 22 November 2026. Entry for the [make.fun news-image-20261122 bounty](https://make.fun/bounty/news-image-20261122).

`main.ts` (Node 22, standard library only, no network) draws the page with a hand-written 5×7 bitmap font, a hand-rolled PNG encoder, and simple vector pictograms, and writes one 1024×1024 image to `$MAKEFUN_OUTPUT_DIR/entry.png`. The output is deterministic: two runs write byte-identical files.

## The day's news

- **Lead — COP31 nears a final deal:** after all-night talks in Antalya, a final text was put to nearly 200 nations at dawn; a plenary is set to approve it at 0600 GMT, with fossil-fuel language back in the draft.
- **Ukraine:** Russian triple-tap strike on Kryvyi Rih, Zelenskyy's home city — 2 killed, 60 wounded.
- **Middle East:** three Houthi ballistic missiles on Riyadh intercepted — the second attack on the capital in days.
- **Markets:** Bitcoin sinks to about $55,250, its lowest since September 2024.
- **Tech:** Nvidia shares down 14% to a 52-week low after a Reuters report of an SEC accounting probe.
- **Sport:** Ireland stun the Springboks in Dublin.
- **Also today:** 24 dead in a Nigeria boat capsize; F-16 crash in Germany; Bayer's $7.25bn Roundup settlement; Belgium air shutdown; Trump vows a 10% credit-card cap.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).

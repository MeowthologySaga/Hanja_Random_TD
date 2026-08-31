# Third-party notices

## three.js

`three` is the only third-party package bundled into the shipped build. It renders the 3D study scene on the main menu (`src/ui/menu3d.ts`); every other screen is plain Canvas 2D and DOM. All remaining npm packages are development-only and are not distributed.

- Package: https://www.npmjs.com/package/three
- Version pinned in `package-lock.json`: `0.185.1`
- Integrity: `sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg==`
- License: MIT — https://github.com/mrdoob/three.js/blob/dev/LICENSE

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the copyright notice and this permission notice being included in all copies or substantial portions of the Software. The Software is provided "as is", without warranty of any kind.

## Fonts

No font files are bundled or downloaded. All typography resolves through system font stacks declared in `index.html` and `src/styles.css` (`Batang`, `Malgun Gothic`, `Pretendard`, `Apple SD Gothic Neo`, `Noto Serif KR`, `ui-monospace`/`Consolas`, with generic `serif`/`sans-serif` fallbacks). There is no `@font-face` rule and no webfont request, so no font license applies to this distribution.

## Unicode Unihan 17.0.0

`src/data/learning-readings.json` is generated from `Unihan_Readings.txt`. `src/data/hanzi-radicals.json` and `src/data/cheonjamun-strokes.json` are generated from the `kRSUnicode` and `kTotalStrokes` fields in `Unihan_IRGSources.txt` in the Unicode 17.0.0 Unihan data archive.

- Source: https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip
- Data guide: https://www.unicode.org/reports/tr38/
- License: https://www.unicode.org/license.txt
- Copyright © 1991-2026 Unicode, Inc.
- `Unihan_IRGSources.txt` SHA-256: `D1C817DD7DB84295DAB0643C277D97C2FA742C245F8824E6736C2A0935095325`

Permission is hereby granted, free of charge, to any person obtaining a copy of the Unicode data files or software and associated documentation to deal in them without restriction, including the rights to use, copy, modify, merge, publish, distribute, and sell copies, and to permit others to do so, provided that the Unicode copyright and permission notice appears with copies or in associated documentation.

The data files and software are provided “as is”, without warranty of any kind. See the linked Unicode License v3 for the complete terms and disclaimer.

## Make Me A Hanzi stroke graphics

`public/data/hanzi-stroke-glyphs-v1.json` is generated from the `strokes` (outline paths) and `medians` (skeleton polylines) fields of Make Me A Hanzi's `graphics.txt`, trimmed to this game's character roster. It is fetched only when a player turns on the optional stroke-order guide (설정 → 학습 모드 · 획순 안내), which is **off by default**. When that guide is on, the outlines draw the character being traced and the medians point at one stroke at a time, so both come from the same source and align exactly.

Two modifications are made, both purely for size: coordinates are rounded to a 4-unit grid on the source's 1024-unit em (0.68px at the size the game draws), and the absolute-coordinate path strings are rewritten with relative coordinates and no separator spaces. No shape is altered beyond that rounding. Characters outside this game's roster are omitted.

- Source: https://github.com/skishore/makemeahanzi/blob/master/graphics.txt
- Source SHA-256: `a28c478b5178e98f67f510b2d52fde08a69dc664654ef43498253b9b764d46ee` (fetched 2026-08-30)
- Build script: `npm run generate:glyphs -- <graphics.txt>` (`scripts/build-stroke-glyphs.mjs`, which verifies the hash above)
- Project code license: MIT — https://github.com/skishore/makemeahanzi/blob/master/LICENSE.txt
- Character data license: Arphic Public License, inherited from the Arphic 文鼎 fonts the graphics were derived from — https://github.com/skishore/makemeahanzi/blob/master/APLL.txt

The Arphic Public License permits copying and distribution of the font data and derived works provided this notice and the license accompany them, and that changes are documented. The changes made here are documented above: the roster is trimmed, coordinates are rounded to a 4-unit grid, and paths are re-encoded with relative coordinates.

## libhangul Korean Hanja dictionary

Korean hun-eum fields in `src/data/learning-readings.json` are generated from libhangul's `data/hanja/hanja.txt`, pinned to commit `a34aef73378c0992316861bbf13fc914ee7577d9`.

- Source: https://github.com/libhangul/libhangul/blob/a34aef73378c0992316861bbf13fc914ee7577d9/data/hanja/hanja.txt
- Source SHA-256: `DD44DCC856CF542B1022D0F39C2E9B9F8805FDCC5923BE80F04849ED97CE0996`
- Copyright (c) 2005,2006 Choe Hwanjin

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the author nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The game adds a small curated Korean hun-eum layer for 24 unusual Korean-catalog glyphs that do not carry a usable libhangul gloss. That local layer is original project data and is not copied from another dictionary. Neither Unicode nor libhangul endorses this game.

## National Institute of Korean Language Korean Basic Dictionary

Learner-friendly Korean definitions in `src/data/korean-easy-meanings.json` are derived in part from the Korean Basic Dictionary full JSON release dated 2026-08-19. The game retains only the compact definitions selected for its Korean 1,001-character codex; ambiguous, archaic, and unmatched entries are independently rewritten in `src/data/korean-easy-meaning-overrides.json`.

- Source: https://krdict.korean.go.kr/download/downloadPopup
- Open API information: https://krdict.korean.go.kr/kor/openApi/openApiInfo
- Copyright policy: https://www.korean.go.kr/front/page/pageView.do?mn_id=105&page_id=P000189
- Download archive SHA-256: `7CF41E62A2A36158A8BE2B6D2F84C086221E9B29D4345C44E5497EEBF21C8C40`
- Source attribution: National Institute of Korean Language, Korean Basic Dictionary

The Korean Basic Dictionary describes its information as freely reusable subject to the site's copyright policy. National Institute of Korean Language public works carrying the Korea Open Government License attribution mark require source attribution. This project identifies the institution, work, release, source URLs, and exact archive hash, and does not imply endorsement by the National Institute of Korean Language.

## Thousand Character Classic reading cross-check

The public-domain Thousand Character Classic source order and the conventional Korean readings used by `src/data/cheonjamun-phrases.ts` were cross-checked against the Korean Wikisource translation page, revision 415809. The game's short gameplay meanings are independently condensed paraphrases.

- Source: https://ko.wikisource.org/wiki/번역:천자문
- Original text: public domain
- Wikisource page license: CC BY-SA 4.0
- License: https://creativecommons.org/licenses/by-sa/4.0/deed.ko

## Project-generated map artwork

`public/assets/map/hanji-ink-field/hanji-paper-base.png` was generated specifically for this project without a third-party source image. Its production prompt is preserved beside the PNG, and `map-manifest.json` records the runtime layer contract. The route, arrows, portals, formations, actors, hit regions, and effects remain original Canvas/CSS runtime graphics rather than baked content in the generated texture.

## Project-generated Suno audio

The BGM and one-shot SFX listed in `src/data/audio-manifest.json` were generated for this project with Suno and then normalized locally for game playback. `Moonlit Codex` was supplied by the project owner; the downloaded file identifies Suno source ID `1efbbbd9-fd2d-4fc9-9408-5a287baf5852`. The shipped derivative removes embedded cover art and creation metadata while the manifest and `public/assets/audio/audio-qc.json` preserve provenance, duration, loudness, file size, and checksum records.

Suno usage and distribution rights depend on the account plan and terms that applied when each asset was created. Before public release or competition submission, the project owner must retain the applicable account/subscription evidence and confirm that the chosen terms cover the intended distribution. This notice records provenance and does not replace that rights verification.

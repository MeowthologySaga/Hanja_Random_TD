# Third-party data notices

## Unicode Unihan 17.0.0

`src/data/learning-readings.json` is generated from `Unihan_Readings.txt`. `src/data/hanzi-radicals.json` and `src/data/cheonjamun-strokes.json` are generated from the `kRSUnicode` and `kTotalStrokes` fields in `Unihan_IRGSources.txt` in the Unicode 17.0.0 Unihan data archive.

- Source: https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip
- Data guide: https://www.unicode.org/reports/tr38/
- License: https://www.unicode.org/license.txt
- Copyright © 1991-2026 Unicode, Inc.
- `Unihan_IRGSources.txt` SHA-256: `D1C817DD7DB84295DAB0643C277D97C2FA742C245F8824E6736C2A0935095325`

Permission is hereby granted, free of charge, to any person obtaining a copy of the Unicode data files or software and associated documentation to deal in them without restriction, including the rights to use, copy, modify, merge, publish, distribute, and sell copies, and to permit others to do so, provided that the Unicode copyright and permission notice appears with copies or in associated documentation.

The data files and software are provided “as is”, without warranty of any kind. See the linked Unicode License v3 for the complete terms and disclaimer.

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

## Thousand Character Classic reading cross-check

The public-domain Thousand Character Classic source order and the conventional Korean readings used by `src/data/cheonjamun-phrases.ts` were cross-checked against the Korean Wikisource translation page, revision 415809. The game's short gameplay meanings are independently condensed paraphrases.

- Source: https://ko.wikisource.org/wiki/번역:천자문
- Original text: public domain
- Wikisource page license: CC BY-SA 4.0
- License: https://creativecommons.org/licenses/by-sa/4.0/deed.ko

## Project-generated map artwork

`public/assets/map/hanji-ink-field/hanji-paper-base.png` was generated specifically for this project without a third-party source image. Its production prompt is preserved beside the PNG, and `map-manifest.json` records the runtime layer contract. The route, arrows, portals, formations, actors, hit regions, and effects remain original Canvas/CSS runtime graphics rather than baked content in the generated texture.

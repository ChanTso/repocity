# Third-party notices

RepoCity source and the generated city-kit assets are distributed under Apache License 2.0. Third-party software remains under its own license.

## JavaScript dependencies

The exact dependency graph, versions, source tarballs, and integrity hashes are recorded in `package-lock.json`. Package license texts are installed by npm inside each package directory and are not replaced by the RepoCity license.

The audited lockfile contains the following license families:

- MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0;
- Apache-2.0 and MIT OR Apache-2.0;
- Mozilla Public License 2.0;
- LGPL-3.0-or-later in optional Sharp/libvips platform packages;
- CC0-1.0 and CC-BY-4.0 data packages;
- Python-2.0.

Important direct dependencies include React, Three.js, React Three Fiber, Drei, Next.js compatibility types, Vinext, Vite, Cloudflare development tooling, TypeScript, ESLint, Vitest, Zod, Zustand, Commander, and Lucide. Their exact versions and transitive license metadata are authoritative in the lockfile.

`webgl-constants@1.1.1` omits a machine-readable license field but ships an MIT `LICENSE` file.

Sharp and its prebuilt libvips packages are development/build dependencies. When redistributing compiled binaries or deployment archives, preserve all notices supplied by those packages and comply with the applicable LGPL terms.

## Original visual assets

All committed files under `public/assets/city-kit-v1/` are deterministic works generated for RepoCity by `scripts/generate-city-kit.mjs`. They contain no marketplace assets, ripped game content, third-party logos, or copied landmarks. Their checksums and inventory are in [the city-kit manifest](docs/assets/city-kit-v1-manifest.md).

Screenshots in `docs/screenshots/` and `docs/media/` are captures of the RepoCity application. They must not contain external game screenshots, private repositories, personal information, or unlicensed artwork.

## Trademarks

Product and package names belong to their respective owners. Their mention identifies compatibility or dependencies and does not imply endorsement.

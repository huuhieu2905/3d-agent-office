# Third-party assets

Every asset shipped with the app and its license (Constitution V). All of them are usable for this
non-commercial personal project. Nothing is downloaded at run time (Constitution III).

## Fonts (concept E+, feature 002)

| Font | Use | Author | Source | License |
|---|---|---|---|---|
| Baloo 2 (variable, latin / latin-ext / vietnamese) | Headings, name tags | Ek Type | npm `@fontsource-variable/baloo-2@5.3.0` (Fontsource, from Google Fonts) | SIL Open Font License 1.1 |
| Nunito (variable, latin / latin-ext / vietnamese) | Body text | Vernon Adams, Jacques Le Bailly, Manvel Shmavonyan, Alexei Vanyashin | npm `@fontsource-variable/nunito@5.3.0` | SIL Open Font License 1.1 |

The woff2 files are bundled by Vite from `node_modules` (see `src/web/fonts.css`); the OFL text ships in
each package's `LICENSE` file.

## Generated in code (no third-party files)

- **Employees**: soft cartoon figures (concept E+) built from primitives with procedural animation —
  `src/web/scene/character.ts`. (Feature 001's CC0 robot model, RobotExpressive by Tomás Laulhé /
  Quaternius, is no longer shipped.)
- **Furniture, walls, glass, door mat, plants, water cooler**: `src/web/scene/furniture/`.
- **Floor and wall textures** (light-oak planks, lime-wash): canvas textures in `src/web/theme/concept.ts`.
- **Lighting environment**: three.js `RoomEnvironment` (part of the three.js package, MIT) rendered into a
  PMREM at start-up instead of an HDRI file — `src/web/scene/OfficeMood.tsx`.
- **Park, walkers, cars, skyline, city landmarks, weather**: `src/web/scene/park/`, `src/web/scene/city/`,
  `src/web/scene/weather/`.

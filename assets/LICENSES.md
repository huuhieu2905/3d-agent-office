# Third-party assets

Every asset shipped in `assets/` and its license (Constitution V). All assets are usable for this
non-commercial personal project.

| File | Asset | Author | Source | License |
|---|---|---|---|---|
| `models/characters/robot.glb` | RobotExpressive (animated low-poly robot: Idle, Walking, Sitting, Standing, Wave, Yes, No, ThumbsUp, Jump, Dance, Death, Punch, Running, WalkJump; morph targets Angry/Surprised/Sad) | Tomás Laulhé ([Quaternius](https://quaternius.com)); glTF conversion by Don McCurdy | [three.js repository r170](https://github.com/mrdoob/three.js/tree/r170/examples/models/gltf/RobotExpressive) | CC0 1.0 |

Furniture, walls, glass, plants and the water cooler are built procedurally from low-poly primitives in
`src/web/scene/furniture/` (no third-party files).

The park (lawn, paths, trees, flowers), walkers, cars, the distant skyline and the five city landmarks
(Hà Nội: Lotte Center + Tháp Rùa; TP.HCM: Landmark 81; Singapore: Marina Bay Sands; Tokyo: Tokyo Tower;
New York: Empire State Building) are simplified low-poly shapes generated in code
(`src/web/scene/park/`, `src/web/scene/city/`, `src/web/scene/weather/`) — no third-party files.

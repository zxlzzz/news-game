# Project Memory

Local project memo, updated only on Hsinlung's request ("更新memo").
Detailed asset results belong in the linked inventories, not duplicated here.

---

## Cache — next session (2026-09-24)

- The game now lives in `godot/` (Godot 4.7.2, created 2026-09-23 from `docs/scene_spec.md`);
  `sth/godot-npc/` and `assets/fromgodot/game-godot/` were deleted (history in git).
  `godot/README.md` is the entry point. Nothing from this work has been committed yet.
- Built so far is only the foundation: scene = folder of `level.tscn` / `palette.tres` /
  `view.tscn` / `population.tres`; `@tool` ground bands; type library `godot/types/`
  (root node unscaled, scale on child `model`); global slots / material maps / style
  params in `godot/core/`; runtime look applied by `core/level.gd`. The ink shaders and
  the NPC stick mapping were moved over unchanged (`--check-mapping` → `tools/check_mapping.gd`,
  still MAPPING_OK). No navigation, NPC placement or behaviour yet.
- **Next:** Hsinlung will later ask for one complete street scene built in one go. Until
  then models are being supplied (see below). Do not modify `street_demo` on your own —
  he said so explicitly when I offered to swap in the new buildings.
- Model supply: ChatGPT builds models from `godot/modeling/模型制作说明.md` (+ `素材清单.md`,
  `docs/建模规范与参数.md`, `check_model.py`, the terrace example script); I only review —
  run `check_model.py`, rerun the delivered build scripts (they must reproduce the GLB
  byte-for-byte), then look in Godot (`modeling/review_models.tscn`). Every model comes with
  a rerunnable `build_<name>.py` whose sizes are named constants: that is how global model
  changes will be made later. First batch accepted 2026-09-23: `building_a`, `building_b`,
  `crosswalk`. The expanded list for the full scene is in `godot/素材清单.md`:
  a street plus the park opposite it, laid out after the old `assets/scene.json` (converted
  to metres; Hsinlung asked for the old project's layout to be reused). New slot `water`.

## Visual direction — open, as of 2026-09-24

- Chants of Sennaar is still the preferred direction (10 reference shots in
  `docs/巴别塔圣歌-游戏实拍/`), but **the palette must stay black/white/gray**; a coloured
  result that pleases does not count. Either make palettes work for any hue under stated
  relations, or optimise gray only.
- Hsinlung's palette rule: the "paper" (background and the dominant large surfaces) is
  **the lightest gray in the picture, and not white**. My 0.62 mid-gray paper test was
  "too dark".
- His current judgement: the palette is not the key problem — **scene density** is; a
  somewhat denser street should look more natural. Hence the expanded model list.
- Findings from the style study (`godot/studies/style_steps/`, renders in `out/`), not yet
  applied to the game: light should hit the street-facing fronts (current `view.tscn`
  light puts every front in the hatched grazing band); 4x MSAA visibly cleans lines;
  window/door recesses need ~0.5 m depth to read; roofs must not be one bright lid (both
  delivered buildings cap the roof with a full `trim` slab); the brightest slots must stay
  on small areas; the global `window` slot is `flat`, which hides shadows inside recesses.
  Sennaar's fitted colours converted to equal-luminance grays gave walls ~0.91, dark
  multiplier ~0.40 and line colour ~0.39 gray (ours: 0.68 / 0.58 / 0.12).
- He cannot yet say what he wants; show pictures rather than ask abstract questions, and
  do not stack follow-up proposals at the end of a report.

## NPC mapping — accepted 2026-09-20

- 规则与参数唯一文档入口：`docs/design-plans/npc-skeleton-mapping.md`。源数据保留 Kimodo SOMA77 `posed_joints`（米、Y 向上），映射用其中 16 个源关节；不是直接抽 11 点，也不把映射结果写回资源。
- 造型：实心圆头；无肩/胯横线、胸口折点、手指或脸；四肢从颈根/胯发散。等宽圆头线，躯干/脖子线宽乘 1.15；头与线段按深度排序，不画影子。
- 下半身和根位移随腿长同比缩放，两骨 IK 解膝；头部在躯干局部坐标系扣除站姿固有前倾；肩向量分配给两段手臂，举臂最小张角 70°，平滑向侧方展开并同步旋转前臂。
- 参数由 Hsinlung 定下，约 0.58m / 4.9 头身是有意的画风，不按成人真实比例纠正。具体数值只维护在 `docs/design-plans/npc-skeleton-mapping.md`，不沿用旧预览默认值。
- 已接受取舍：cheer 头顶合手会被分开；cross_arms 正面像十字；photo_overhead 前举手臂会遮脸。不要再次作为待修缺陷。
- 后续落实要求：共用纯映射函数 + 独立参数 JSON，供调参、出图、运行时消费；之后支持单动作微调。参考 HTML 当前仍用全局参数/内嵌默认值，尚未完成共用模块化；规则已定不等于集成已完成。
- 简检：参考 HTML 内置 6 条/660 帧，默认参数下无无效坐标，骨段长度和缩放后踝目标误差仅浮点精度。63 条总览是图像证据，不等于全部动作逐帧验证；未证明通用防穿模或精确手掌接触。

## Motion playback contract — accepted 2026-09-19

- `docs/design_route_npc_behavior.md` / `docs/design_route_npc_motion_supply.md` §5：防止的是
  NPC 位置瞬移，不要求统一首尾姿势。行为可在任意帧切换，不保证播完。
- 位置接续归未来播放端：下一片段接在 NPC 当前位置，消费相对根位移，不直接
  套用素材绝对坐标；与导航协调速度、方向和避障，不能重复累加位移。
- 一次性/持续/移动由行为侧使用方式决定，不强制素材分类字段或文件夹。
  首尾约束、循环加工、进入/保持/退出分段均可选；需要分段可标在同一素材上。
  相同端点不保证自然循环，同脚两次落地也不保证全身/朝向接缝连续。
- 当前设计允许立即换动作，不强制先播退出。蹲姿切行走等姿势跳变，实际看到
  不能接受时再补过渡，不提前扩成素材返工要求。生成 worker 已按需开启约束。

## Kimodo motion assets — current production track

- Scope: independent full-body, single-person NPZ assets; no old overlays, JSON
  clip conversion, runtime registration or Pixi integration. Deliver
  `assets/animations/npz/<simple_english_name>/motion.npz` plus accepted `meta.json`.
  No `v2`/`seed42` in names; use trailing `1`, `2` only for intentionally retained
  parallel motions. Selected assets are in Git. Attempts/parameters belong in
  metadata and Chinese inventories, not additional deliverable versions.
- Queue authority is `assets/动作生成任务清单.md`: A → B → remaining C → D → E.
  F needs object/support-position conditions first; G/H are inventory only and need
  later explicit scope authorization. Do not automatically retry deferred motions,
  especially head nod/shake or unsupported finger gestures.
- Prompt engineering is our responsibility: describe visible limb motion, side,
  sequence, hold and release; choose duration per action. Generation success or a
  matching prompt is not quality evidence. After repeated semantic failures,
  reassess and record why the motion is deferred instead of endlessly changing seeds.
- Review front/side samples and motion data; inspect consecutive frames around
  suspicious peaks. Use all 77 joints and hand close-ups for contact/hand gestures:
  **nearby wrists do not establish palm contact**. Simplified skeleton sheets hid
  crossed palms/fingers in `clap`/`palms_together`, so those were rejected. Moving
  clips need a camera following the root plus separate world-displacement checks.
- SOMA-RP predicts 30 joints; exported finger joints use fixed relaxed local poses.
  Text cannot independently shape thumbs-up or fist/palm salutes. Do not mistake
  plausible arm placement for correct hand articulation. Record actual limitations
  (fast movement, incomplete release, minor ground/contact issues) per asset; no
  promise of skin collision checks, precise prop grasping or seamless loops.
- Reusable worker: `scripts/kimodo_motion_batch.py`, one JSON request per stdin line,
  e.g. `{"name":"smoke","text":"A person ...","duration":4,"seed":42}`; `quit`
  releases the model. It writes candidates and review sheets/metrics, never selects
  a result or schedules the next motion. Standard settings: 30 fps, 100 steps,
  text/constraint CFG 2/2, `num_samples=1`, official post-processing enabled.
- Detailed review: `scripts/kimodo_review_detail.py <folder> [<folder> ...] --hands`;
  `--frames` accepts exactly seven indices for focused continuity checks. Run in
  Kimodo's Python environment. Prior temporary batch sheets were cleaned; they can
  be regenerated from retained NPZs. Experiment evidence below remains available.
- Environment: fork source `C:\kimodo-trial\kimodo` mounted at `/workspace`;
  `compose.win.yaml` in that directory. Containers: `kimodo-nf4-text-encoder-1` and
  `kimodo-nf4-demo-1`; preview `http://localhost:7860/`. Model
  `Kimodo-SOMA-RP-v1.1`, encoder `matbee/kimodo-llm2vec-nf4`. RTX 4060 has 8 GB VRAM.
  For the authorized batch, stop only the demo to avoid duplicate models, keep the
  encoder, copy the worker to its temporary directory, and run there with
  `TEXT_ENCODER_URL=http://localhost:9550/` and `--output /tmp/kimodo_review`.
  Quit the worker before restoring the demo. Generation/review was explicitly
  authorized for this batch; it does not authorize running the game or Godot.
- Endpoint and contact evidence: [实验说明](assets/animation_checks/endpoint_constraints/说明.md),
  retained NPZs/arrays/PNGs in that directory, and `scripts/kimodo_constraint_probe.py`.
  Six contact columns are LeftFoot, LeftToeBase, LeftToeEnd, RightFoot, RightToeBase,
  RightToeEnd (77-joint indices 69/70/71/74/75/76). ToeEnd duplicates ToeBase in the
  four-to-six-column export; these are thresholded model labels, not zero-height tests.
- Fork supports `FullBodyConstraintSet` through `constraint_lst`, using model 30-joint
  positions and global rotations mapped from SOMA77. `cross_arms` and `hands_on_hips`
  trials constrain both endpoints to `stand_idle` frame 0: both enter/hold/release,
  but most action occurs in the first half. Mean endpoint error across 77 joints is
  about 0.000442 m **including official post-processing**, not raw diffusion accuracy.
  These trials did not replace the original holding-pose assets. Worker support:
  `--endpoint-pose <stand_idle motion.npz>` plus request `"endpoints":true`.
  Choose constraints per motion; do not force a common start/end onto walking/turning.

## Third-party model libraries (removed from the repo 2026-09-25)

- The game uses none of them now; new models come from ChatGPT. The repo copies were deleted:
  `assets/fromgodot/quaternius-*` (Downtown City / Stylized Nature MegaKit, ~2.2 GB, never
  tracked) and `assets/fromgodot/street-selected/` (19 CC0 props, history in git, with its
  `SOURCES.md`; the chess table survives as `godot/models/Chess_Table.glb`).
- If needed again: original downloads in `D:\Godot\assets\Downtown City MegaKit[Standard]` and
  `...\Stylized Nature MegaKit[Standard]` (or quaternius.com). The deleted repo copy had three
  buildings' `MI_FakeInterior_*` materials blackened (script
  `sth/asset-import-spike/tools/blacken_fake_interiors.py`, in git history); the D: originals
  do not. `godot/core/material_maps/quaternius.tres` still maps their material names.
- Blender `D:\steam\steamapps\common\Blender`, Godot `D:\Godot`.

---

## Meta: how "更新memo" works

When Hsinlung asks to "update memo", it means two things, not just one:

1. **Add** new content (facts learned, decisions made, plans agreed on).
2. **Remove** stale content — this is the part that's easy to skip and
   shouldn't be. Prune regularly, don't just accumulate.
   - Forward-looking plans / roadmap items → keep.
   - Ideas that turned out wrong, abandoned approaches, resolved
     one-off issues → delete outright, don't hoard them "just in case".
   - Unsure whether something is still relevant → ask Hsinlung instead
     of guessing either way (keep-by-default or delete-by-default are
     both wrong defaults here).

There is no automatic second trigger: maintain this file only when Hsinlung
explicitly asks. Finishing a patch does not by itself authorize a memo edit.

## Git 与临时交接文件（2026-09-20）

- 不自动提交；等 Hsinlung 明确要求再 commit。旧的“每个 patch 自动提交”约定已被此次指示替代。

---

## Collaboration workflow with Hsinlung

- Treat Hsinlung as technically fluent and as the project's final decision-maker.
  This is a **collaborative, co-designed** process — not "Hsinlung specs it,
  Claude executes it".
- Investigate discoverable facts independently. Ask only when uncertainty is
  genuine and different answers would materially change the work. Running the
  game/harness is a separate permission boundary described below.
- Standard shape of a task, start to finish:
  1. Hsinlung proposes a need.
  2. **Jointly analyze the need together.** This step is mandatory —
     do not jump straight to a plan/report the moment Hsinlung finishes
     describing something. Discuss first.
  3. Draft an initial design.
  4. Iterate and refine the design together.
  5. Write the finalized result into `tasks.md`.
  6. Execute strictly in `tasks.md`'s stated order and requirements.
- Once a task is already fully spec'd in `tasks.md` (steps 1-5 already
  happened, possibly in an earlier session), step 6 doesn't need a fresh
  round of discussion before starting — that discussion already happened
  when it was written down. Low-level implementation gaps the spec
  doesn't cover (a rendering architecture detail, which of several
  reasonable approximations to use) are Claude's call: pick a reasonable
  default, document the reasoning in code comments/roadmap, and flag it
  in the report back — don't stall progress asking about every one.
  Confirmed 2026-08-11 during O-2 (Hsinlung: "没实际问题就一直工作就行
  ... 发现问题再修改即可").
- If a reported bug survives two genuine fix attempts, offering to just
  remove the feature is a legitimate next move, not a cop-out — don't
  keep re-diagnosing the same spot for a third narrower patch on your own
  initiative. Case: a camera-follow-viewfinder feature got two rounds of
  fixes (real root causes each time) and Hsinlung was still unhappy with
  the feel; he asked to delete it outright rather than a third attempt.
  Comply directly — don't argue for one more fix first.
  **How that one actually ended (2026-08-11)**: deleting it broke the
  feature (with the viewfinder still in world coordinates, killing the
  follow logic meant you could drag it to the screen edge and never
  reach the rest of the world), so Hsinlung reverted the deletion. What
  finally worked was neither another parameter tweak nor deletion, but
  **reframing what the thing is**: the viewfinder stopped being a patch
  of world ground and became a screen-space UI rectangle floating on
  the top layer, independent of camera pan/zoom — at which point the
  camera had no reason to follow anything and the logic was deleted for
  free. Lesson: after two failed fixes, the productive move is usually
  to question the object's coordinate system / ownership, not to tune
  the algorithm a third time. Hsinlung specified this reframing himself.

## Running the game (explicit permission required)

- **Superseded 2026-08-25: there is no standing exception.** The earlier
  2026-08-11 permission to run tests freely applied only to that work context;
  it must not be treated as permanent authorization. Unless Hsinlung explicitly
  authorizes it in the current conversation, do not start the game, run any
  simulation, or use any other
  harness. A visual task by itself is not permission: ask first. Permission for
  one inspection expires after that inspection and cannot be reused later.
- **Godot (2026-09-23):** Hsinlung allowed running Godot (headless import, windowed
  one-frame screenshots via `-- --shot`) for building the `godot/` foundation and the
  style study, and Blender for re-running delivered build scripts. Treat it as scoped to
  that work; for a clearly new kind of run, ask.
- **Comparing against the old look**: Hsinlung suggested checking out a
  pre-change commit locally, screenshotting, then returning. This worked
  well and is worth reusing — a detached-HEAD `git checkout <old>` →
  screenshot → `git checkout <branch>` costs almost nothing and settles
  "is this regression or intended?" far faster than reasoning about it.

## Working style (from the 2026-08 O series, still valid)

- Once a batch is spec'd, run straight through it and only stop for things that
  genuinely need his decision. Don't check in after every sub-step. (Committing
  still waits for his explicit request, see above.)
- He reviews by looking at the picture, not the code: "我毕竟看不到实物"
  / "我发现问题再修改即可". So the useful report back is *what changed
  visually* and *what he should look at*, not a code walkthrough.
- He spots real bugs from the rendering. When he says something looks off,
  take it literally and go measure.

## Product purpose and visual identity

- Long-term structure: build a reusable simulated society first, then close the
  game loop in which the player photographs street events, writes/publishes news,
  and the report visibly changes beliefs and eventually society parameters.
  (The old js design docs for this — witness memory, belief layer, news pipeline — were
  deleted 2026-09-25; they are in git history if ever wanted.)
- The thematic anchor is the Loftus misinformation effect: witnesses are altered
  by post-event information and leading questions; framing does not merely describe
  the simulated world, it participates in constructing it.
- Stick figures are a deliberate product choice, not temporary programmer art. The
  shared skeleton keeps animation/accessory production reusable, while the absence of
  facial expressions preserves ambiguity about what an observed action means. The
  overall palette is no longer assumed to be permanently grayscale: grayscale or other
  colour treatments may be scene-level Looks, but must not be baked destructively into
  reusable models. Visual improvement should strengthen spatial credibility and
  readability without accidentally removing that ambiguity.
- Innovation and portfolio quality take priority over speed; there is no deadline.

## 3D asset principles (from the 2026-09-03 pipeline; Pixi-render parts dropped 2026-09-24)

- Models keep their source colours / semantic material names; grayscale, palettes and
  outlines are scene-level Looks, never baked into a model (a baked-gray batch lost hue
  and detail and was deleted). Removing a model's confirmed harmful content is allowed.
- Buildings are complete assembled models, not modular pieces placed in the scene.
- Real directional shadows are kept; they must come from geometry and light for
  environment, vehicles and NPCs alike, never fake foot circles. (NPC sticks currently
  cast no shadow, per the 2026-09-19 decision.)

## Motion framework background — separate from current NPZ production

- **Breadth first:** many distinct-meaning actions across scenes; within-action
  individuality is secondary and cannot create new meanings. The assistant does
  the generation/review work; Hsinlung reacts and spot-checks. Avoid demanding a
  large classification exercise from him before producing useful assets.
- “动作系统重构” also includes the runtime NPC behavior framework. Producing NPZs
  does not mature that framework, prove skeleton sufficiency or authorize runtime
  migration. Registering, composing and scheduling new actions remain separate work.
- The former "still design/not implemented" motion-supply status and compression
  survey next step are superseded by the current Kimodo batch and its two inventories
  above. No new Mixamo mapping, pose-cache format or overlay refactor is implied.

## Priority and quality target clarified 2026-08-25

- Building a reusable society-simulation foundation first, then making the news
  game on it, is both Hsinlung's personal development approach and the project's
  formal long-term direction; he is the sole developer, so these are not separate
  tracks.
- Current strict priority is: continue improving the picture first → refactor the
  action system (both behavior maturity and action supply/reuse) → only then add
  new content.
- Visual acceptance is not “good enough for the style.” The deliberate stick-figure
  style remains while the final palette is open, but everything outside that choice
  should aim for an ideal result: scale, spatial credibility, composition,
  hierarchy, readability, motion presentation, and the feeling of a coherent real
  street. The current post-O-series result is still unsatisfactory.
- One authorized live inspection on 2026-08-25 found that individual anchors such
  as the human, car, and bench are broadly plausible in isolation, but the whole
  scene is not. Empty sky/road/park occupy too much of the frame; buildings read as
  thin backdrop slabs rather than the dominant built mass; repeated large trees
  overpower people and props; at the particular inspected zoom, pedestrians and
  their social actions were too small to read; and the oblique ground does not yet
  form a convincing common volume with mostly frontal vertical objects. Building
  floor proportions and thin top/side faces are especially weak. The single
  inspected zoom does **not** prove that the camera system lacks an action-readable
  scale, because its zoom range was not evaluated; do not generalize that symptom
  into a fixed-camera requirement.
- **Corrected visual root-cause hypothesis (2026-08-25):** do not demand one fixed
  “canonical frame,” an exact street range, or one ideal on-screen person size. The
  player already has zoom, pan, and adjustable capture framing, so there is no single
  truthful number. The useful requirement is functional and multi-scale: the player
  must be able to move into an action-readable view where pose, gesture, participants,
  and what they are doing can actually be understood; wider views can serve discovery
  and context. The visual system must remain coherent across that zoom range. Start
  assessment from a representative action at an action-readable zoom, then check that
  the same street still holds together when widened. Camera framing, street-band
  proportions, building mass, and projection should support this range. Prop-by-prop
  polish should come after this functional readability is established.
- **Further correction from Hsinlung:** action-readable zoom is an engineering acceptance
  condition, not the starting point of the visual rebuild. The main design problem remains the assembled
  world's spatial coherence: ground plane, building mass, vertical objects, proportions,
  depth cues, and scene hierarchy must read as one street across views.
## Standing permission: add tooling freely (2026-08-12)

Hsinlung: "你如果觉得没问题直接加些你会用的工具也行，以后想加就直接加不用和我
特意说（除非大到进不了 github）". So: **add skills, check scripts, dev
harnesses etc. without asking.** Only flag it if something would be too
large to commit. Describe any new tool briefly in plain language when it matters.

This permission is permission to add tooling, not to execute the game,
simulations, previews, or other harnesses. Execution is governed by the
2026-08-25 rule above and requires explicit current authorization.

`/.claude/` in the repo is gitignored (local only). Don't confuse it with `~/.claude/`, which is
Hsinlung's personal Claude Code state (session logs, global settings, and
the separate auto-memory directory) and has nothing to do with the project.

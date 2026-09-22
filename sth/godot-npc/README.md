# godot-npc (Godot 4.7.2, Forward+)

The style_test project (Desktop/style_test/proj, 2026-09-19 style fit) plus one walking NPC stick figure
driven by Kimodo npz motion through the accepted NPC mapping. Details, decisions and open points:
NPC_PATH_REPORT.md.

Run (from this folder):
  godot --path .                                                  watch: terrace scene + NPC, keeps running
  godot --path . -- --params res://params/terrace.json --out output/x.png   render one frame, save, quit
  godot --path . --headless -- --check-mapping                   MAPPING_OK / MAPPING_FAIL, quits
Use Godot_v4.7.2-stable_win64_console.exe to see printed output on Windows. output/ is git-ignored.

- params/terrace.json : current fitted parameters (the set that produced 01/02 images)
- style/ink_fill.gdshader : fill (flat color, tones, screen hatching)
- style/ink_line.gdshader : lines (constant pixel width; boundary / crease / silhouette edges)
- style/stick_line.gdshader : NPC stick lines only (round caps, width in figure metres)
- style/ink_builder.gd    : extracts edges from any mesh, swaps materials, adds back-face shadow proxies
- style/grade.gdshader    : screen corner tint
- npc/                    : NPC mapping port, loader, player, mapping check; npc_scene.json places the NPC
- npc/motion/             : written by scripts/export-npc-motion.py (repo root) from assets/animations/npz
- tools/build_terrace.py  : generates models/terrace.glb (pip: trimesh manifold3d shapely)
- tools/make_mapping_reference.mjs : regenerates npc/mapping_reference.json from sth/motion-study/skeleton-mapping.mjs
- tools/npz_to_stick.py   : Kimodo SOMA npz -> 11 stick joints JSON (old static stick; its output was removed 2026-09-22)

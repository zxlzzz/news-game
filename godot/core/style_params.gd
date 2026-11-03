## Global drawing-style parameters (scene_spec.md §2 画风参数), the same for every scene.
## Meanings: 建模规范与参数.md 二. Pixel values are for a 1080-pixel-high viewport.
class_name StyleParams
extends Resource

@export var band_ndl := 0.5
@export var hatch_period_px := 5.0
@export var cover_grazing := 0.15
@export var cover_shade := 0.4
@export var cover_dark := 0.4
@export var light_scale := 1.0
@export var line_width_px := 1.5
## Metres a line is pulled toward the camera so its own surface does not hide it.
@export var line_depth_bias := 0.03
@export var crease_deg := 35.0

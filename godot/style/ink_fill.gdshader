// Surface shader: flat base color, hard tones and screen-space hatching.
// Tone rules: lit & facing (N·L >= band)        -> base color, no strokes
//             lit & grazing (0 < N·L < band)    -> mid color, sparse strokes
//             cast shadow on a facing surface   -> mid color, dense strokes
//             cast shadow on grazing / N·L <= 0 -> dark color, dense strokes
// *_mul are sRGB-space multipliers on the base color.
shader_type spatial;
render_mode specular_disabled, ambient_light_disabled;

uniform vec3 base_color : source_color = vec3(1.0);
uniform vec3 mid_mul = vec3(0.84, 0.73, 0.77);
uniform vec3 dark_mul = vec3(0.63, 0.25, 0.48);
uniform vec3 stroke_mid_mul = vec3(0.70, 0.42, 0.58);
uniform vec3 stroke_dark_mul = vec3(0.54, 0.12, 0.49);
uniform float band_ndl = 0.5;
uniform float shadow_threshold = 0.5;
uniform float hatch_period_px = 5.0;
uniform float cover_grazing = 0.15;
uniform float cover_shade = 0.4;
uniform float cover_dark = 0.4;
uniform float light_scale = 1.0;
uniform int debug_mode = 0;
uniform bool flat_color = false;          // slot flag: ignore light (lit windows, signs)
uniform bool use_alpha_tex = false;       // slot flag: cut out by texture alpha (decals)
uniform sampler2D alpha_tex : source_color, filter_linear_mipmap;

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

void fragment() {
	ALBEDO = base_color;
	if (use_alpha_tex && texture(alpha_tex, UV).a < 0.5) discard;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	bool shadowed = ATTENUATION < shadow_threshold;
	bool facing = ndl >= band_ndl;
	float stripe = fract((FRAGCOORD.x + FRAGCOORD.y) / hatch_period_px);
	vec3 m;
	if (ndl <= 0.0 || (shadowed && !facing)) {
		m = stripe < cover_dark ? stroke_dark_mul : dark_mul;
	} else if (shadowed) {
		m = stripe < cover_shade ? stroke_mid_mul : mid_mul;
	} else if (!facing) {
		m = stripe < cover_grazing ? stroke_mid_mul : mid_mul;
	} else {
		m = vec3(1.0);
	}
	if (flat_color) m = vec3(1.0);
	DIFFUSE_LIGHT = lin(m) * light_scale;
	if (debug_mode == 1) DIFFUSE_LIGHT = vec3(max(ndl, 0.0), ATTENUATION, 0.0);
}

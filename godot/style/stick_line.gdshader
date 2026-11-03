// Line shader for NPC stick figures only, copied from ink_line.gdshader (the environment keeps using
// ink_line unchanged). Each segment is a quad expanded in screen space around the segment, as in ink_line.
// Differences from ink_line:
//  - round caps: the quad reaches half a line width past each endpoint and fragment() trims it to a
//    capsule, so every segment is an equal-width line with round ends (NPC mapping spec section 5);
//  - the width is given per segment in model units (figure metres, skeleton-params.json line x multiplier)
//    and converted to pixels here, so lines scale with the figure instead of keeping a fixed pixel width;
//  - no silhouette-only edges: stick segments are always drawn, so no face normals are carried.
// CUSTOM0 = other endpoint (xyz) + side (w, -1/+1)                         [same as ink_line]
// CUSTOM1 = x: line width in model units, y: 0 at the segment start, 1 at its end
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, fog_disabled;

uniform vec3 line_color : source_color = vec3(0.6, 0.05, 0.3);
uniform float depth_bias = 0.03;  // meters pulled toward the camera

// Capsule coordinates in pixels, multiplied by clip w: interpolation is perspective-correct, so dividing
// by the interpolated w in fragment() gives values linear in screen space (with the orthographic camera
// w is 1 and this changes nothing). x: along start->end from the start, y: across, z: segment length,
// w: half width.
varying vec4 cap_px_w;
varying float cap_w;

void vertex() {
	vec3 other = CUSTOM0.xyz;
	float side = CUSTOM0.w;
	bool at_end = CUSTOM1.y > 0.5;
	vec3 v0 = (MODELVIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 v1 = (MODELVIEW_MATRIX * vec4(other, 1.0)).xyz;
	bool ortho = PROJECTION_MATRIX[3][3] > 0.5;
	vec3 view_dir = ortho ? vec3(0.0, 0.0, -1.0) : normalize(v0);
	vec3 pull = ortho ? vec3(0.0, 0.0, 1.0) : -view_dir;
	v0 += pull * depth_bias;
	v1 += pull * depth_bias;
	vec4 p0 = PROJECTION_MATRIX * vec4(v0, 1.0);
	vec4 p1 = PROJECTION_MATRIX * vec4(v1, 1.0);
	vec2 half_vp = VIEWPORT_SIZE * 0.5;
	vec2 s0 = p0.xy / p0.w * half_vp;
	vec2 s1 = p1.xy / p1.w * half_vp;
	vec2 d = s1 - s0;
	float seg_px = length(d);
	// a zero-length segment still gets a square quad (trimmed to a round dot): its two ends take opposite directions
	d = seg_px > 1e-5 ? d / seg_px : (at_end ? vec2(-1.0, 0.0) : vec2(1.0, 0.0));
	vec2 n = vec2(-d.y, d.x);
	// width: model units -> view units (uniform node scale) -> pixels at this vertex's depth.
	// Orthographic: PROJECTION_MATRIX[1][1] = 2 / camera size, so pixels = view units * viewport height / size.
	float width_view = CUSTOM1.x * length(MODELVIEW_MATRIX[0].xyz);
	float r = 0.5 * width_view * abs(PROJECTION_MATRIX[1][1]) * half_vp.y / p0.w;
	vec2 off = (n * side - d) * r;
	p0.xy += off / half_vp * p0.w;
	POSITION = p0;
	float along = at_end ? seg_px + r : -r;
	float across = at_end ? -side * r : side * r;
	cap_px_w = vec4(along, across, seg_px, r) * p0.w;
	cap_w = p0.w;
}

void fragment() {
	vec4 c = cap_px_w / cap_w;
	float beyond = c.x < 0.0 ? c.x : max(c.x - c.z, 0.0);
	if (beyond * beyond + c.y * c.y > c.w * c.w) {
		discard;
	}
	ALBEDO = line_color;
}

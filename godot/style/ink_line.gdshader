// Line shader: each edge is a quad expanded in screen space to a constant pixel width.
// CUSTOM0 = other endpoint (xyz) + side (w, -1/+1)
// CUSTOM1 = normal of face A (xyz) + kind (w: 1 = always drawn, 0 = silhouette-only)
// CUSTOM2 = normal of face B (xyz)
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, fog_disabled;

uniform vec3 line_color : source_color = vec3(0.6, 0.05, 0.3);
uniform float width_px = 1.5;
uniform float depth_bias = 0.03;  // meters pulled toward the camera

void vertex() {
	vec3 other = CUSTOM0.xyz;
	float side = CUSTOM0.w;
	vec3 v0 = (MODELVIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 v1 = (MODELVIEW_MATRIX * vec4(other, 1.0)).xyz;
	bool ortho = PROJECTION_MATRIX[3][3] > 0.5;
	vec3 view_dir = ortho ? vec3(0.0, 0.0, -1.0) : normalize(v0);
	bool visible = true;
	if (CUSTOM1.w < 0.5) {
		vec3 na = (MODELVIEW_MATRIX * vec4(CUSTOM1.xyz, 0.0)).xyz;
		vec3 nb = (MODELVIEW_MATRIX * vec4(CUSTOM2.xyz, 0.0)).xyz;
		visible = dot(na, view_dir) * dot(nb, view_dir) < 0.0;
	}
	vec3 pull = ortho ? vec3(0.0, 0.0, 1.0) : -view_dir;
	v0 += pull * depth_bias;
	v1 += pull * depth_bias;
	vec4 p0 = PROJECTION_MATRIX * vec4(v0, 1.0);
	vec4 p1 = PROJECTION_MATRIX * vec4(v1, 1.0);
	vec2 half_vp = VIEWPORT_SIZE * 0.5;
	vec2 s0 = p0.xy / p0.w * half_vp;
	vec2 s1 = p1.xy / p1.w * half_vp;
	vec2 d = s1 - s0;
	d = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
	vec2 n = vec2(-d.y, d.x);
	vec2 off = (n * side - d * 0.5) * width_px * 0.5;
	p0.xy += off / half_vp * p0.w;
	POSITION = visible ? p0 : vec4(2.0, 2.0, 2.0, 1.0);
}

void fragment() {
	ALBEDO = line_color;
}

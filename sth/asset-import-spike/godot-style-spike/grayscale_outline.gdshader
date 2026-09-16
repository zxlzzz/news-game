// Edge-detection structure adapted from Conlan2's CC0 shader:
// https://godotshaders.com/shader/chants-of-sennaar-style-shader/
// This spike replaces the coloured palette and screen-space shadow hatch with
// five grayscale tones so real DirectionalLight3D shadows can be judged alone.
shader_type spatial;
render_mode unshaded, fog_disabled;

uniform vec3 edge_colour : source_color = vec3(0.08);
uniform float edge_width : hint_range(1.0, 6.0, 0.5) = 2.0;
uniform float depth_edge_threshold : hint_range(0.0, 10.0, 0.01) = 0.05;
uniform float max_dist : hint_range(1.0, 1000.0, 1.0) = 150.0;
uniform float outline_strength : hint_range(0.0, 1.0, 0.05) = 1.0;
uniform float tone_steps : hint_range(0.0, 16.0, 1.0) = 5.0;
uniform float gray_min : hint_range(0.0, 1.0, 0.01) = 0.30;
uniform float gray_max : hint_range(0.0, 1.0, 0.01) = 0.88;

uniform sampler2D depth_texture : hint_depth_texture, filter_nearest;
uniform sampler2D screen_texture : hint_screen_texture, filter_nearest;
uniform sampler2D normal_texture : hint_normal_roughness_texture, filter_nearest;

void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

const mat3 SOBEL_Y = mat3(
	vec3(1.0, 0.0, -1.0),
	vec3(2.0, 0.0, -2.0),
	vec3(1.0, 0.0, -1.0)
);

const mat3 SOBEL_X = mat3(
	vec3(1.0, 2.0, 1.0),
	vec3(0.0, 0.0, 0.0),
	vec3(-1.0, -2.0, -1.0)
);

float sobel(mat3 pixels) {
	float x = dot(SOBEL_X[0], pixels[0]) + dot(SOBEL_X[1], pixels[1]) + dot(SOBEL_X[2], pixels[2]);
	float y = dot(SOBEL_Y[0], pixels[0]) + dot(SOBEL_Y[1], pixels[1]) + dot(SOBEL_Y[2], pixels[2]);
	return length(vec2(x, y));
}

float linear_depth(vec2 uv, mat4 inverse_projection) {
	float depth = texture(depth_texture, uv).x;
	vec3 ndc = vec3(uv * 2.0 - 1.0, depth);
	vec4 view = inverse_projection * vec4(ndc, 1.0);
	view.xyz /= view.w;
	return clamp(-view.z, 0.0, max_dist);
}

vec3 view_normal(vec2 uv) {
	return texture(normal_texture, uv).rgb * 2.0 - 1.0;
}

float depth_edge(vec2 uv, vec2 offset, mat4 inverse_projection) {
	float c = linear_depth(uv, inverse_projection);
	float n = linear_depth(uv + vec2(0.0, -offset.y), inverse_projection);
	float s = linear_depth(uv + vec2(0.0, offset.y), inverse_projection);
	float e = linear_depth(uv + vec2(offset.x, 0.0), inverse_projection);
	float w = linear_depth(uv + vec2(-offset.x, 0.0), inverse_projection);
	float nw = linear_depth(uv + vec2(-offset.x, -offset.y), inverse_projection);
	float ne = linear_depth(uv + vec2(offset.x, -offset.y), inverse_projection);
	float sw = linear_depth(uv + vec2(-offset.x, offset.y), inverse_projection);
	float se = linear_depth(uv + vec2(offset.x, offset.y), inverse_projection);
	// A Sobel first derivative also sees a flat ground plane as an edge when the
	// camera is oblique. A Laplacian is near zero on that continuous slope and
	// responds to actual depth discontinuities instead.
	float cardinal_laplacian = abs(n + s + e + w - 4.0 * c);
	float diagonal_laplacian = abs(nw + ne + sw + se - 4.0 * c) * 0.5;
	float edge = max(cardinal_laplacian, diagonal_laplacian);
	float threshold = depth_edge_threshold * (1.0 + c / max_dist);
	return smoothstep(threshold, threshold * 2.0, edge);
}

float normal_edge(vec2 uv, vec2 offset) {
	vec3 c = view_normal(uv);
	vec3 n = view_normal(uv + vec2(0.0, -offset.y));
	vec3 s = view_normal(uv + vec2(0.0, offset.y));
	vec3 e = view_normal(uv + vec2(offset.x, 0.0));
	vec3 w = view_normal(uv + vec2(-offset.x, 0.0));
	vec3 nw = view_normal(uv + vec2(-offset.x, -offset.y));
	vec3 ne = view_normal(uv + vec2(offset.x, -offset.y));
	vec3 sw = view_normal(uv + vec2(-offset.x, offset.y));
	vec3 se = view_normal(uv + vec2(offset.x, offset.y));
	mat3 delta = mat3(
		vec3(length(nw - c), length(n - c), length(ne - c)),
		vec3(length(w - c), 0.0, length(e - c)),
		vec3(length(sw - c), length(s - c), length(se - c))
	);
	return smoothstep(0.12, 0.42, sobel(delta));
}

float palette_gray(vec3 colour) {
	float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
	float level = clamp(luminance, 0.0, 1.0);
	if (tone_steps >= 2.0) {
		float intervals = tone_steps - 1.0;
		level = floor(level * intervals + 0.5) / intervals;
	}
	return mix(gray_min, gray_max, level);
}

void fragment() {
	vec2 uv = vec2(UV.x, 1.0 - UV.y);
	vec2 offset = (edge_width * 0.5) / VIEWPORT_SIZE;
	// The downloaded assets carry detailed normal maps (brick grain, bark, leaves).
	// For this first readability test, those details must not become black ink.
	float line = depth_edge(uv, offset, INV_PROJECTION_MATRIX);
	float gray = palette_gray(texture(screen_texture, uv).rgb);
	ALBEDO = mix(vec3(gray), edge_colour, line * outline_strength);
}

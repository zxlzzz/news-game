shader_type spatial;
render_mode unshaded, fog_disabled;

// A bright monochrome clear-line treatment. The source colour render remains
// untouched; this full-screen pass only changes the final camera image.
uniform vec3 ink : source_color = vec3(0.14, 0.15, 0.16);
uniform vec3 paper : source_color = vec3(0.945, 0.941, 0.922);

uniform float depth_line_width : hint_range(0.5, 4.0, 0.05) = 1.25;
uniform float depth_threshold : hint_range(0.001, 1.0, 0.001) = 0.075;
uniform float depth_line_strength : hint_range(0.0, 1.0, 0.01) = 0.88;
uniform float detail_line_strength : hint_range(0.0, 1.0, 0.01) = 0.22;
uniform float detail_threshold : hint_range(0.01, 1.0, 0.01) = 0.20;

uniform float tone_steps : hint_range(2.0, 12.0, 1.0) = 7.0;
uniform float tone_flattening : hint_range(0.0, 1.0, 0.01) = 0.34;
uniform float shadow_floor : hint_range(0.0, 0.5, 0.01) = 0.24;
uniform float black_point : hint_range(0.0, 0.5, 0.005) = 0.045;
uniform float white_point : hint_range(0.5, 1.0, 0.005) = 0.96;
uniform float mid_lift : hint_range(0.4, 1.6, 0.01) = 0.84;
uniform float max_distance : hint_range(10.0, 500.0, 1.0) = 180.0;

uniform sampler2D depth_texture : hint_depth_texture, filter_nearest;
uniform sampler2D screen_texture : hint_screen_texture, filter_linear;

const mat3 SOBEL_X = mat3(
	vec3(1.0, 2.0, 1.0),
	vec3(0.0, 0.0, 0.0),
	vec3(-1.0, -2.0, -1.0)
);

const mat3 SOBEL_Y = mat3(
	vec3(1.0, 0.0, -1.0),
	vec3(2.0, 0.0, -2.0),
	vec3(1.0, 0.0, -1.0)
);


void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}


float luminance(vec3 colour) {
	return dot(colour, vec3(0.2126, 0.7152, 0.0722));
}


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
	return clamp(-view.z, 0.0, max_distance);
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

	// Second derivatives ignore the continuous depth ramp of an oblique ground
	// plane while retaining silhouettes and true depth discontinuities.
	float cardinal = abs(n + s + e + w - 4.0 * c);
	float diagonal = abs(nw + ne + sw + se - 4.0 * c) * 0.5;
	float threshold = depth_threshold * (1.0 + c / max_distance);
	return smoothstep(threshold, threshold * 2.2, max(cardinal, diagonal));
}


float detail_edge(vec2 uv, vec2 offset) {
	mat3 values = mat3(
		vec3(
			luminance(texture(screen_texture, uv + vec2(-offset.x, -offset.y)).rgb),
			luminance(texture(screen_texture, uv + vec2(0.0, -offset.y)).rgb),
			luminance(texture(screen_texture, uv + vec2(offset.x, -offset.y)).rgb)
		),
		vec3(
			luminance(texture(screen_texture, uv + vec2(-offset.x, 0.0)).rgb),
			luminance(texture(screen_texture, uv).rgb),
			luminance(texture(screen_texture, uv + vec2(offset.x, 0.0)).rgb)
		),
		vec3(
			luminance(texture(screen_texture, uv + vec2(-offset.x, offset.y)).rgb),
			luminance(texture(screen_texture, uv + vec2(0.0, offset.y)).rgb),
			luminance(texture(screen_texture, uv + vec2(offset.x, offset.y)).rgb)
		)
	);
	float edge = sobel(values);
	return smoothstep(detail_threshold, detail_threshold * 2.4, edge);
}


float map_tone(float source_luminance) {
	float normalized = smoothstep(black_point, white_point, source_luminance);
	normalized = pow(normalized, mid_lift);
	float intervals = max(tone_steps - 1.0, 1.0);
	float stepped = floor(normalized * intervals + 0.5) / intervals;
	float flattened = mix(normalized, stepped, tone_flattening);
	return mix(shadow_floor, 1.0, flattened);
}


void fragment() {
	vec2 uv = vec2(UV.x, 1.0 - UV.y);
	vec2 depth_offset = vec2(depth_line_width) / VIEWPORT_SIZE;
	vec2 detail_offset = vec2(1.0) / VIEWPORT_SIZE;
	vec3 source = texture(screen_texture, uv).rgb;

	float tone = map_tone(luminance(source));
	vec3 gray = mix(ink, paper, tone);
	float silhouette = depth_edge(uv, depth_offset, INV_PROJECTION_MATRIX) * depth_line_strength;
	float detail = detail_edge(uv, detail_offset) * detail_line_strength;
	float line = clamp(max(silhouette, detail), 0.0, 1.0);
	ALBEDO = mix(gray, ink, line);
}

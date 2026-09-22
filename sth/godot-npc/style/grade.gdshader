// Full-screen color grade: radial tint from one corner, applied to fills and lines alike.
shader_type canvas_item;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear;
uniform vec3 tint_color : source_color = vec3(0.9, 0.3, 0.5);
uniform vec2 tint_center = vec2(0.0, 1.0);   // UV, (0,1) = bottom-left
uniform float tint_radius = 0.7;
uniform float tint_mix = 0.35;        // blend toward tint color
uniform float tint_multiply = 0.4;    // multiply by tint color
uniform float aspect = 1.7778;

void fragment() {
	vec3 c = texture(screen_tex, SCREEN_UV).rgb;
	vec2 q = (SCREEN_UV - tint_center) * vec2(aspect, 1.0);
	float t = 1.0 - smoothstep(0.0, tint_radius, length(q));
	vec3 g = mix(c, tint_color, tint_mix * t);
	g = mix(g, g * tint_color, tint_multiply * t);
	COLOR = vec4(g, 1.0);
}

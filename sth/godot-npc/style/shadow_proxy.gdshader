// Shadow-only proxy: casts from back faces so lit front faces never self-shadow (no acne, no bias needed).
shader_type spatial;
render_mode unshaded, cull_front;
uniform bool skip = false;   // surfaces that must not cast (glass, hidden interiors)
void fragment() { if (skip) discard; ALBEDO = vec3(0.0); }

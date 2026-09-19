# Street corner study

This Godot project is a deliberately small composition and style test. It combines
three Quaternius buildings with matching street furniture and
nature assets, adds a simple street/sidewalk ground plane, then captures one fixed
orthographic view. `output/street_corner.png` is the original colour baseline and
`output/street_corner_monochrome.png` is the current monochrome clear-line treatment.

Running the project normally leaves the study open in the original unfiltered look.
Press `0` for the original image or `1` for the monochrome clear-line filter. The
numbered filter registry intentionally supports at most ten entries (`0` through `9`).
Passing the user argument `--capture` writes the filtered PNG and exits automatically;
adding `--raw` writes the original PNG instead.

The three building GLBs use the source-library versions whose `MI_FakeInterior_*`
materials were changed in-place to flat black; their other materials remain intact.
Lighting and shadows are ordinary 3D scene effects. The monochrome treatment is a
non-destructive camera pass whose editable parameters live in the standalone
`filters/monochrome_clearline.tres` resource; its rendering code lives in
`moebius_monochrome.gdshader`.

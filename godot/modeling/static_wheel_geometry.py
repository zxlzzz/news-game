"""Fit fixed side-wheel supports without introducing motion groups or contacts."""
from model_geometry import bpy, cylinder, bar, subtract


def support_side_wheels(body_name, side_x, axis_y, axis_z, radius, thickness,
                        side_clearance, fork_radius, support_top_y, axle_radius,
                        bearing_clearance, axle_end_extension):
    body = bpy.data.objects[body_name]
    wheels = sorted((obj for obj in bpy.context.scene.objects
                     if obj.type == 'MESH' and obj.name.split('.')[0] == 'wheel'),
                    key=lambda obj: obj.name)
    assert len(wheels) == 2, (body_name, 'Expected two existing side wheels')
    fork_x = side_x - thickness / 2 - side_clearance - fork_radius
    bore_inner_x = side_x - thickness / 2 - bearing_clearance
    axle_end_x = side_x + axle_end_extension
    bore_outer_x = axle_end_x + bearing_clearance
    assert bore_outer_x < side_x + thickness / 2
    assert support_top_y > axis_y and fork_x > 0
    for index, wheel in enumerate(wheels):
        center = (wheel.location.x, wheel.location.z, -wheel.location.y)
        sign = 1 if center[0] > 0 else -1
        assert max(abs(center[0] - sign * side_x), abs(center[1] - axis_y),
                   abs(center[2] - axis_z)) < 0.000001, (wheel.name, center)
        # Clear the full circular envelope, not just the initial polygon pose.
        cutter = cylinder('wheel_shell_cut', radius + side_clearance,
                          thickness + side_clearance * 2, center, None,
                          axis=(1, 0, 0))
        subtract(body, cutter, 'supported_wheel_well')
        # An inward blind bearing leaves the original visible outer wheel cap.
        cutter = cylinder('wheel_bore_cut', axle_radius + bearing_clearance,
                          bore_outer_x - bore_inner_x,
                          (sign * (bore_inner_x + bore_outer_x) / 2,
                           axis_y, axis_z), None, axis=(1, 0, 0))
        subtract(wheel, cutter, 'supported_wheel_bearing')
        # Fixed mount lands in the retained inboard shell beside the wheel well.
        bar('wheel_mount_%d' % index, (sign * fork_x, axis_y, axis_z),
            (sign * fork_x, support_top_y, axis_z), fork_radius, 'metal_dark')
        bar('wheel_spindle_%d' % index, (sign * fork_x, axis_y, axis_z),
            (sign * axle_end_x, axis_y, axis_z), axle_radius, 'metal_dark')

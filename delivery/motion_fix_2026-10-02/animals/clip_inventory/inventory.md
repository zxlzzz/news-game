# Animal clip inventory

Read from the actual Godot import and independently from the formal GLBs. No source/runtime changes.

170 real animations: Husky 60 (12 original + 48 NG), Shiba 60 (12 + 48), Cat 50 (2 + 48). No RESET is imported.

Name mapping: source NG_Sniff_Ground_Loop imports as NG_Sniff_Ground in all three libraries and is marked LINEAR. Every other name is unchanged. inventory.json stores source_name and godot_name separately.

All original clips currently have Godot LOOP_NONE and no exported loop declaration (absence is not an explicit false). Their measured whole-bone translation/rotation closure is recorded in inventory.json, along with whole-skin closure. Bone-pose continuity is tested at 1 micrometer / 0.0001 degree. Each dog has ten closed-pose originals; Death and Jump_ToIdle have substantially different endpoints. Cat Idle is closed; Walking is approximately closed, with 0.282884 mm joint position / 0.194863 degree rotation / 0.326997 mm skin differences, so this inspection does not label it a strict closed-loop pass. Pose closure alone does not establish the intended repeat behavior of an attack/jump/react action.

NG source extras.loop agrees with motion_specs.json. All declared NG loops have matching first/last whole-skin poses within 1 micrometer. Godot currently imports only NG_Sniff_Ground_Loop as LINEAR for each breed; all other NG clips import as NONE. Thus imported loop_mode alone loses the authored hold-loop contract.

Every in/hold/out clip is individually present. Selecting an enter or exit plays its own full duration once; it need not be wrapped in locomotion. The previous controller sequences remain a separate transition/interrupt diagnostic.

## husky

| Exact clip name | Seconds | Source loop | Godot loop | State start to end | Whole-skin endpoint gap (mm) |
|---|---:|---|---|---|---:|
| Attack | 1.2 | unspecified | NONE | original | 4.47236e-13 |
| Death | 1.06667 | unspecified | NONE | original | 948.066 |
| Eating | 2.66667 | unspecified | NONE | original | 2.96348e-13 |
| Gallop | 0.566667 | unspecified | NONE | original | 0.00029762 |
| Gallop_Jump | 0.933333 | unspecified | NONE | original | 3.51358e-13 |
| Idle | 3.33333 | unspecified | NONE | original | 4.52041e-13 |
| Idle_2 | 3.33333 | unspecified | NONE | original | 3.33356e-13 |
| Idle_2_HeadLow | 4 | unspecified | NONE | original | 4.47236e-13 |
| Idle_HitReact_Left | 0.666667 | unspecified | NONE | original | 4.54882e-13 |
| Idle_HitReact_Right | 0.666667 | unspecified | NONE | original | 3.63216e-13 |
| Jump_ToIdle | 1.33333 | unspecified | NONE | original | 297.893 |
| Walk | 1.06667 | unspecified | NONE | original | 0.000233203 |
| NG_Stand_Breathe | 4 | yes | NONE | stand to stand | 4.57809e-13 |
| NG_Stand_Alert | 3 | yes | NONE | stand to stand | 3.51083e-13 |
| NG_Look_Left | 2.8 | no | NONE | stand to stand | 2.38762e-13 |
| NG_Head_Tilt_Left | 2.6 | no | NONE | stand to stand | 2.38762e-13 |
| NG_Ear_Twitch_Left | 1.2 | no | NONE | stand to stand | 2.30555e-13 |
| NG_Paw_Offer_Left | 3 | no | NONE | stand to stand | 2.25914e-13 |
| NG_Urinate_Left | 4 | no | NONE | stand to stand | 3.51122e-13 |
| NG_Sit_Paw_Offer_Left | 3 | no | NONE | sit to sit | 2.42365e-13 |
| NG_Look_Right | 2.8 | no | NONE | stand to stand | 1.11022e-13 |
| NG_Head_Tilt_Right | 2.6 | no | NONE | stand to stand | 1.66533e-13 |
| NG_Ear_Twitch_Right | 1.2 | no | NONE | stand to stand | 2.22045e-13 |
| NG_Paw_Offer_Right | 3 | no | NONE | stand to stand | 1.66533e-13 |
| NG_Urinate_Right | 4 | no | NONE | stand to stand | 3.51122e-13 |
| NG_Sit_Paw_Offer_Right | 3 | no | NONE | sit to sit | 1.36018e-13 |
| NG_Look_Around | 5 | no | NONE | stand to stand | 2.38762e-13 |
| NG_Look_Up | 2.8 | no | NONE | stand to stand | 2.31493e-13 |
| NG_Look_Down | 2.8 | no | NONE | stand to stand | 2.38762e-13 |
| NG_Ear_Twitch_Both | 1.4 | no | NONE | stand to stand | 3.35372e-13 |
| NG_Tail_Wag_Slow | 3 | yes | NONE | stand to stand | 3.14191e-13 |
| NG_Tail_Wag_Happy | 2 | yes | NONE | stand to stand | 3.72386e-13 |
| NG_Tail_Tuck_Cautious | 3 | no | NONE | stand to stand | 3.8572e-19 |
| NG_Sniff_Air | 3 | no | NONE | stand to stand | 2.38762e-13 |
| NG_Sniff_Ground_Enter | 1.8 | no | NONE | stand to sniff | 577.621 |
| NG_Sniff_Ground_Loop -> NG_Sniff_Ground | 3.2 | yes | LINEAR | sniff to sniff | 4.57786e-13 |
| NG_Sniff_Ground_Exit | 1.6 | no | NONE | sniff to stand | 577.621 |
| NG_Shake_Off | 2.2 | no | NONE | stand to stand | 5.55155e-13 |
| NG_Shake_Head | 1.2 | no | NONE | stand to stand | 2.28878e-13 |
| NG_Sit_Down | 2 | no | NONE | stand to sit | 545.713 |
| NG_Sit_Idle | 4 | yes | NONE | sit to sit | 2.35207e-13 |
| NG_Sit_Look_Around | 5 | yes | NONE | sit to sit | 4.47575e-13 |
| NG_Sit_Wag | 3 | yes | NONE | sit to sit | 4.49478e-13 |
| NG_Sit_Get_Up | 1.8 | no | NONE | sit to stand | 545.713 |
| NG_Lie_Down | 2.4 | no | NONE | stand to lie | 661.164 |
| NG_Lie_Idle | 4 | yes | NONE | lie to lie | 3.36805e-13 |
| NG_Lie_Get_Up | 2 | no | NONE | lie to stand | 661.164 |
| NG_Sit_To_Lie | 2.2 | no | NONE | sit to lie | 402.029 |
| NG_Lie_To_Sit | 2.2 | no | NONE | lie to sit | 402.029 |
| NG_Sleep_Enter | 2 | no | NONE | lie to sleep | 350.014 |
| NG_Sleep_Breathe | 5 | yes | NONE | sleep to sleep | 3.43335e-13 |
| NG_Sleep_Wake | 1.8 | no | NONE | sleep to lie | 350.014 |
| NG_Play_Bow | 3 | no | NONE | stand to stand | 4.71056e-13 |
| NG_Stretch_Front | 5 | no | NONE | stand to stand | 3.45496e-13 |
| NG_Startle | 1.2 | no | NONE | stand to stand | 2.38762e-13 |
| NG_Side_Lie_Enter | 2.4 | no | NONE | lie to side_lie | 376.478 |
| NG_Side_Lie_Breathe | 5 | yes | NONE | side_lie to side_lie | 0 |
| NG_Side_Lie_Exit | 2.4 | no | NONE | side_lie to lie | 376.478 |
| NG_Scratch_Left | 4.4 | yes | NONE | sit to sit | 3.34963e-13 |
| NG_Scratch_Right | 4.4 | yes | NONE | sit to sit | 3.33356e-13 |

## shibainu

| Exact clip name | Seconds | Source loop | Godot loop | State start to end | Whole-skin endpoint gap (mm) |
|---|---:|---|---|---|---:|
| Attack | 1.2 | unspecified | NONE | original | 2.38762e-13 |
| Death | 1.06667 | unspecified | NONE | original | 656.77 |
| Eating | 2.66667 | unspecified | NONE | original | 2.50303e-13 |
| Gallop | 0.566667 | unspecified | NONE | original | 0.000267357 |
| Gallop_Jump | 0.933333 | unspecified | NONE | original | 2.87861e-13 |
| Idle | 3.33333 | unspecified | NONE | original | 2.83105e-13 |
| Idle_2 | 3.33333 | unspecified | NONE | original | 1.67111e-13 |
| Idle_2_HeadLow | 4 | unspecified | NONE | original | 2.39668e-13 |
| Idle_HitReact_Left | 0.666667 | unspecified | NONE | original | 2.64339e-13 |
| Idle_HitReact_Right | 0.666667 | unspecified | NONE | original | 3.41422e-13 |
| Jump_ToIdle | 1.33333 | unspecified | NONE | original | 208.869 |
| Walk | 1.06667 | unspecified | NONE | original | 0.000152968 |
| NG_Stand_Breathe | 4 | yes | NONE | stand to stand | 2.39668e-13 |
| NG_Stand_Alert | 3 | yes | NONE | stand to stand | 1.14439e-13 |
| NG_Look_Left | 2.8 | no | NONE | stand to stand | 2.02064e-13 |
| NG_Head_Tilt_Left | 2.6 | no | NONE | stand to stand | 2.48253e-13 |
| NG_Ear_Twitch_Left | 1.2 | no | NONE | stand to stand | 1.17757e-13 |
| NG_Paw_Offer_Left | 3 | no | NONE | stand to stand | 2.00148e-13 |
| NG_Urinate_Left | 4 | no | NONE | stand to stand | 1.90788e-13 |
| NG_Sit_Paw_Offer_Left | 3 | no | NONE | sit to sit | 3.36178e-13 |
| NG_Look_Right | 2.8 | no | NONE | stand to stand | 2.00148e-13 |
| NG_Head_Tilt_Right | 2.6 | no | NONE | stand to stand | 2.02064e-13 |
| NG_Ear_Twitch_Right | 1.2 | no | NONE | stand to stand | 1.15278e-13 |
| NG_Paw_Offer_Right | 3 | no | NONE | stand to stand | 1.90788e-13 |
| NG_Urinate_Right | 4 | no | NONE | stand to stand | 2.48253e-13 |
| NG_Sit_Paw_Offer_Right | 3 | no | NONE | sit to sit | 2.22045e-13 |
| NG_Look_Around | 5 | no | NONE | stand to stand | 2.37144e-13 |
| NG_Look_Up | 2.8 | no | NONE | stand to stand | 1.90788e-13 |
| NG_Look_Down | 2.8 | no | NONE | stand to stand | 1.90788e-13 |
| NG_Ear_Twitch_Both | 1.4 | no | NONE | stand to stand | 1.18572e-13 |
| NG_Tail_Wag_Slow | 3 | yes | NONE | stand to stand | 2.02064e-13 |
| NG_Tail_Wag_Happy | 2 | yes | NONE | stand to stand | 2.30555e-13 |
| NG_Tail_Tuck_Cautious | 3 | no | NONE | stand to stand | 2.02064e-13 |
| NG_Sniff_Air | 3 | no | NONE | stand to stand | 2.00148e-13 |
| NG_Sniff_Ground_Enter | 1.8 | no | NONE | stand to sniff | 417.275 |
| NG_Sniff_Ground_Loop -> NG_Sniff_Ground | 3.2 | yes | LINEAR | sniff to sniff | 2.00269e-13 |
| NG_Sniff_Ground_Exit | 1.6 | no | NONE | sniff to stand | 417.275 |
| NG_Shake_Off | 2.2 | no | NONE | stand to stand | 2.25487e-13 |
| NG_Shake_Head | 1.2 | no | NONE | stand to stand | 5.55112e-14 |
| NG_Sit_Down | 2 | no | NONE | stand to sit | 361.588 |
| NG_Sit_Idle | 4 | yes | NONE | sit to sit | 2.43257e-13 |
| NG_Sit_Look_Around | 5 | yes | NONE | sit to sit | 2.22045e-13 |
| NG_Sit_Wag | 3 | yes | NONE | sit to sit | 3.33139e-13 |
| NG_Sit_Get_Up | 1.8 | no | NONE | sit to stand | 361.588 |
| NG_Lie_Down | 2.4 | no | NONE | stand to lie | 339.594 |
| NG_Lie_Idle | 4 | yes | NONE | lie to lie | 3.39439e-13 |
| NG_Lie_Get_Up | 2 | no | NONE | lie to stand | 339.594 |
| NG_Sit_To_Lie | 2.2 | no | NONE | sit to lie | 274.994 |
| NG_Lie_To_Sit | 2.2 | no | NONE | lie to sit | 274.994 |
| NG_Sleep_Enter | 2 | no | NONE | lie to sleep | 249.144 |
| NG_Sleep_Breathe | 5 | yes | NONE | sleep to sleep | 2.81432e-13 |
| NG_Sleep_Wake | 1.8 | no | NONE | sleep to lie | 249.144 |
| NG_Play_Bow | 3 | no | NONE | stand to stand | 2.28905e-13 |
| NG_Stretch_Front | 5 | no | NONE | stand to stand | 2.79026e-13 |
| NG_Startle | 1.2 | no | NONE | stand to stand | 1.78398e-13 |
| NG_Side_Lie_Enter | 2.4 | no | NONE | lie to side_lie | 272.486 |
| NG_Side_Lie_Breathe | 5 | yes | NONE | side_lie to side_lie | 1.73888e-13 |
| NG_Side_Lie_Exit | 2.4 | no | NONE | side_lie to lie | 272.486 |
| NG_Scratch_Left | 4.4 | yes | NONE | sit to sit | 2.23018e-13 |
| NG_Scratch_Right | 4.4 | yes | NONE | sit to sit | 2.22721e-13 |

## cat

| Exact clip name | Seconds | Source loop | Godot loop | State start to end | Whole-skin endpoint gap (mm) |
|---|---:|---|---|---|---:|
| Idle | 1.66667 | unspecified | NONE | original | 1.78937e-13 |
| Walking | 1.66667 | unspecified | NONE | original | 0.326997 |
| NG_Stand_Breathe | 4 | yes | NONE | stand to stand | 1.2658e-13 |
| NG_Stand_Alert | 3 | yes | NONE | stand to stand | 1.57163e-13 |
| NG_Look_Left | 2.8 | no | NONE | stand to stand | 1.14492e-13 |
| NG_Head_Tilt_Left | 2.6 | no | NONE | stand to stand | 1.14492e-13 |
| NG_Paw_Offer_Left | 3 | no | NONE | stand to stand | 4.324e-14 |
| NG_Urinate_Left | 4 | no | NONE | stand to stand | 1.6657e-13 |
| NG_Sit_Paw_Offer_Left | 3 | no | NONE | sit to sit | 5.92859e-14 |
| NG_Look_Right | 2.8 | no | NONE | stand to stand | 1.14492e-13 |
| NG_Head_Tilt_Right | 2.6 | no | NONE | stand to stand | 1.14492e-13 |
| NG_Paw_Offer_Right | 3 | no | NONE | stand to stand | 1.14492e-13 |
| NG_Urinate_Right | 4 | no | NONE | stand to stand | 1.6657e-13 |
| NG_Sit_Paw_Offer_Right | 3 | no | NONE | sit to sit | 5.92859e-14 |
| NG_Look_Around | 5 | no | NONE | stand to stand | 6.20634e-14 |
| NG_Look_Up | 2.8 | no | NONE | stand to stand | 1.14649e-13 |
| NG_Look_Down | 2.8 | no | NONE | stand to stand | 1.14649e-13 |
| NG_Tail_Wag_Slow | 3 | yes | NONE | stand to stand | 1.75961e-13 |
| NG_Tail_Wag_Happy | 2 | yes | NONE | stand to stand | 1.14649e-13 |
| NG_Tail_Tuck_Cautious | 3 | no | NONE | stand to stand | 1.24387e-13 |
| NG_Sniff_Air | 3 | no | NONE | stand to stand | 7.85238e-14 |
| NG_Sniff_Ground_Enter | 1.8 | no | NONE | stand to sniff | 208.352 |
| NG_Sniff_Ground_Loop -> NG_Sniff_Ground | 3.2 | yes | LINEAR | sniff to sniff | 1.24321e-13 |
| NG_Sniff_Ground_Exit | 1.6 | no | NONE | sniff to stand | 208.352 |
| NG_Shake_Off | 2.2 | no | NONE | stand to stand | 1.40671e-13 |
| NG_Shake_Head | 1.2 | no | NONE | stand to stand | 6.20634e-14 |
| NG_Sit_Down | 2 | no | NONE | stand to sit | 364.192 |
| NG_Sit_Idle | 4 | yes | NONE | sit to sit | 2.24229e-13 |
| NG_Sit_Look_Around | 5 | yes | NONE | sit to sit | 1.70144e-13 |
| NG_Sit_Wag | 3 | yes | NONE | sit to sit | 1.24175e-13 |
| NG_Sit_Get_Up | 1.8 | no | NONE | sit to stand | 364.192 |
| NG_Lie_Down | 2.4 | no | NONE | stand to lie | 293.944 |
| NG_Lie_Idle | 4 | yes | NONE | lie to lie | 1.1189e-13 |
| NG_Lie_Get_Up | 2 | no | NONE | lie to stand | 293.944 |
| NG_Sit_To_Lie | 2.2 | no | NONE | sit to lie | 152.33 |
| NG_Lie_To_Sit | 2.2 | no | NONE | lie to sit | 152.33 |
| NG_Sleep_Enter | 2 | no | NONE | lie to sleep | 124.559 |
| NG_Sleep_Breathe | 5 | yes | NONE | sleep to sleep | 1.14439e-13 |
| NG_Sleep_Wake | 1.8 | no | NONE | sleep to lie | 124.559 |
| NG_Play_Bow | 3 | no | NONE | stand to stand | 1.2421e-13 |
| NG_Stretch_Front | 5 | no | NONE | stand to stand | 1.57621e-13 |
| NG_Startle | 1.2 | no | NONE | stand to stand | 1.37195e-13 |
| NG_Side_Lie_Enter | 2.4 | no | NONE | lie to side_lie | 259.618 |
| NG_Side_Lie_Breathe | 5 | yes | NONE | side_lie to side_lie | 1.1533e-13 |
| NG_Side_Lie_Exit | 2.4 | no | NONE | side_lie to lie | 259.618 |
| NG_Knead | 3.6 | yes | NONE | lie to lie | 8.44153e-14 |
| NG_Tail_Tip_Flick | 2.4 | no | NONE | stand to stand | 0 |
| NG_Threat_Arch_Enter | 1 | no | NONE | stand to arch | 100.182 |
| NG_Threat_Arch | 2 | yes | NONE | arch to arch | 1.73888e-13 |
| NG_Threat_Arch_Exit | 1.2 | no | NONE | arch to stand | 100.182 |

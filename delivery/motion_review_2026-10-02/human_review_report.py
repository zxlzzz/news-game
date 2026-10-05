"""Persist reviewed visual coverage and evidence; never edits production files.
Statuses represent this reviewer only. Interaction coverage is integrated by root.
"""
from collections import Counter
from pathlib import Path
import json

OUT=Path(__file__).parent
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8-sig'))
metrics=read('human_runtime_metrics.json')
pages=read('standalone_sheets/manifest.json')
standalone={c:p for p in pages for c in p['clips']}
priority={'phone_urgent','elder_assisted_walk','vending_collect','fruit_weigh','walk_backpack_straps'}
confirmed={'handstand','duck_cover','phone_urgent','elder_assisted_walk','vending_collect','fruit_weigh','walk_backpack_straps'}
visual_limitations={
 'atm_keypad':'Machine obscures frontal hand/control relation; side body motion visible.',
 'choose_item':'Stall obscures frontal hands; precise item contact not established.',
 'read_notice':'Board hides frontal body; side motion visible.',
 'sit_step':'Building hides side view; frontal seated figure visible.',
 'vendor_call':'Counter hides frontal hands; side gesture visible.',
 'vendor_tidy':'Counter hides frontal hand/surface relation; side motion visible.',
 'walk_stairs_up':'Front hides legs and side railings obscure precise sole/tread contacts.',
 'walk_stairs_down':'Side railings obscure precise sole/tread contacts.',
 'vending_collect':'Machine completely hides front; side and source diagrams used. Precise pickup contact delegated.',
}
coverage={}
for cid,m in metrics['clips'].items():
    seen=cid in standalone or cid in priority
    status='delegated_interaction_visual_review'
    if seen:
        status='screened_no_additional_confirmed_issue_at_sampled_views'
        if cid in visual_limitations:status='screened_partial_unconfirmed_due_to_occlusion'
        if m['native_candidates']:status='numeric_candidate_unconfirmed_at_exact_native_time'
        if cid in confirmed:status='confirmed_problem'
    c={'scope':'standalone' if cid in standalone else 'interaction_or_partner',
       'source_numeric_scan':True,'source_native_frames':m['frames_source'],
       'shared_mapper_all_native_frames':True,'godot_pre_final_samples':m['samples_runtime'],
       'runtime_sample_dt_s':m['dt_s'],'stage_cycle_s':m['cycle_s'],
       'visual_reviewed_by_human_reviewer':seen,'screening_status':status,
       'native_mapping_candidate_count':len(m['native_candidates']),
       'repeated_endpoint':m['repeat_endpoint'],'declared_loop':m['declared_loop'],'configured_playback':m['playback']}
    if seen:
        c['rendered_view_count']=2;c['rendered_times_per_view']=24
        c['rendered_evidence']='humans/'+cid+'.png'
    if cid in standalone:c['reviewed_contact_sheet']='standalone_sheets/standalone_'+str(standalone[cid]['page']).zfill(2)+'.png'
    if cid in visual_limitations:c['visual_limitation']=visual_limitations[cid]
    if cid=='run_curve':
        c['rendered_evidence']='follow_pose/run_curve.png'
        c['note']='All 24 times x2 views reviewed after root corrected inspection camera framing. Original crop/scale was inspection tooling, not a game fault.'
    if cid=='handstand':c['rendered_evidence']='follow_pose/handstand.png'
    if cid in ('phone_urgent','elder_assisted_walk','duck_cover'):
        c['additional_exact_godot_times']=15
        c['exact_source_pre_final_evidence']=cid+'_source_pre_final_exact.png'
    if cid in ('cheer','cross_arms'):
        c['accepted_style_note']='Accepted arm/head proportion tradeoff retained; not reported as a defect.'
    if cid=='photo_overhead':c['accepted_style_note']='Accepted actual front occlusion retained; not reported as a defect.'
    coverage[cid]=c
assert len(coverage)==239 and len(standalone)==147
summary={'numeric_clips':239,'native_source_frames':metrics['coverage']['native_source_frames'],
 'actual_godot_runtime_samples':metrics['coverage']['runtime_samples'],
 'standalone_clips_visually_reviewed':147,'additional_priority_clips_visually_reviewed':5,
 'standalone_contact_sheets_reviewed':list(range(1,38)),
 'exact_godot_records':{cid:len(rec['frames']) for cid,rec in read('exact_dump.json').items()},
 'status_counts_this_reviewer':dict(Counter(c['screening_status'] for c in coverage.values())),
 'limit':'24 time samples x2 views are a visual screen, not continuous-video approval. Runtime sample dt varies by stage cycle and may cover multiple source cycles. Shared mapper scan covers native frames; actual Godot exact timings cover only three flagged clips.'}
(OUT/'human_coverage.json').write_text(json.dumps({'summary':summary,'clips':coverage},indent=2),encoding='utf-8')

findings=[
 {'id':'H1','status':'confirmed','layer':'source_to_figure_mapping',
  'claim':'The general relation mapping amplifies small source wrist changes into large final hand/arm changes at particular native frames. Different relation rules contribute; this is not one universal IK-pole failure.',
  'examples':[
   {'clip':'phone_urgent','frames':[2,3],'times_s':[2/30,3/30],'point':'right_hand','mapped_step_cm':57.325,'source_leg_scaled_step_cm':6.813,'evidence':['phone_urgent_source_pre_final_exact.png','focus/phone_urgent_early.png'],
    'causal_diagnostic':'Current 57.33cm; in-memory minSpread disabled 14.79cm; head-touch disabled 57.33cm. Head-touch/overlap/back weights all zero here. The accepted spread style itself is retained; only this large motion amplification is reported.'},
   {'clip':'elder_assisted_walk','frames':[12,13],'times_s':[12/30,13/30],'point':'left_hand','mapped_step_cm':29.017,'source_leg_scaled_step_cm':1.750,'evidence':['elder_assisted_walk_source_pre_final_exact.png'],
    'causal_diagnostic':'Spread diagnostic has little effect on this first jump; source-to-direction/height transformation still needs more isolation.'},
   {'clip':'elder_assisted_walk','frames':[43,44],'times_s':[43/30,44/30],'point':'left_hand','mapped_step_cm':26.319,'source_leg_scaled_step_cm':.586,'evidence':['elder_assisted_walk_source_pre_final_exact.png'],
    'causal_diagnostic':'Current 26.32cm; in-memory spread disabled 1.32cm. Head-touch/overlap/back weights zero.'},
   {'clip':'duck_cover','frames':[47,48],'times_s':[47/30,48/30],'point':'left_hand','mapped_step_cm':20.458,'source_leg_scaled_step_cm':4.655,'evidence':['duck_cover_source_pre_final_exact.png','focus/duck_cover_jump.png'],
    'causal_diagnostic':'Head-touch weight changes 0.0349 to 0.9414 in one native frame; current 20.46cm, head-touch diagnostic disabled 9.68cm, spread disabled 20.82cm.'}
  ],'common_evidence':['human_mapper_trace.json','human_mapper_intervention.json','exact_dump.json']},
 {'id':'H2','status':'confirmed','layer':'mapping_and_support','claim':'handstand loses its palm support: mapped wrists are below the floor, ground correction raises only the head. The rendered result reads as head support with hidden arms.',
  'examples':[{'clip':'handstand','source_frame':0,'source_wrist_heights_m':[.038394,.071666],
   'actual_final_wrist_world_heights_m':[-.359043,-.356376],
   'evidence':['handstand_source_pre_final_support.png','follow_pose/handstand.png']}],
  'code':'contact_pose.gd ground_feet corrects feet and head, with no hand-support correction. Mapped arms are already below floor before this correction.'},
 {'id':'H3','status':'confirmed','layer':'source_motion_plus_mapping','claim':'Some visible arm instability already exists in raw NPZ joints, so a mapping-only correction cannot remove the entire problem.',
  'examples':[
   {'clip':'walk_backpack_straps','frames':[7,8,9,10],'source_right_elbow_steps_leg_scaled_cm':[31.73,32.97],
    'evidence':['walk_backpack_straps_source_pre_final.png','humans/walk_backpack_straps.png'],
    'observation':'Right elbow drops and returns abruptly during a strap-holding walk; source and mapped diagrams show the same brief excursion.'},
   {'clip':'fruit_weigh','frames':[109,110],'source_right_elbow_steps_leg_scaled_cm':[34.5,36.5],
    'evidence':['fruit_weigh_source_pre_final.png','humans/fruit_weigh.png'],
    'observation':'Right wrist remains almost stationary while source elbow changes direction sharply; mapping adds another amplification around frame107.'},
   {'clip':'vending_collect','frames':[97,98,99],'source_right_wrist_steps_leg_scaled_cm':[41.51,39.65],
    'evidence':['vending_collect_source_pre_final_source_event.png','humans/vending_collect.png'],
    'observation':'One native frame drives the wrist down and the next drives it back up during collection; already present in source. Machine obscures frontal render.'}
  ],'numeric_evidence':'human_extra_numbers.json'},
 {'id':'H4','status':'confirmed_playback_behavior_not_material_rejection','layer':'preview_playback','claim':'Sources without repeated endpoints are looped by the preview default, interpolating the final source pose back to frame0 in one native-frame interval. Many are one-shot gestures; others have no explicit loop metadata. Endpoint differences are not by themselves defective source loops.',
  'examples':[{'clip':'scratch_head','source_root_aligned_endpoint_difference_cm':109.50},
   {'clip':'stand_up','source_root_aligned_endpoint_difference_cm':74.57},
   {'clip':'trip_fall','source_root_aligned_endpoint_difference_cm':119.60}],
  'count_nonrepeat_default_loop':99,
  'code':'ClipPose.pose chooses frame0 after the last mapped frame when no duplicated endpoint exists; empty-ground defaults to looping unless playback once is configured.',
  'qualification':'This describes current preview playback. It does not establish how every future behavior transition should play or that these 99 source files all need regeneration.'}
]
unconfirmed=[{'clip':cid,'candidate_count':len(v['native_candidates']),'status':'needs_exact_native_time_visual_and_semantic_check'} for cid,v in metrics['clips'].items() if v['native_candidates'] and cid not in confirmed]
artifact={'summary':summary,'confirmed_findings':findings,'remaining_numeric_candidates':unconfirmed,
 'occluded_visual_relations':visual_limitations,
 'accepted_style_preserved':['cheer overhead separate hands','cross_arms front cross','photo_overhead actual front occlusion','general minSpread/proportion choices'],
 'no_production_changes':True,
 'interpretation':'Only confirmed examples justify the listed defects; no all-library PASS, no defect from a large pose difference alone, and no required fix proposed in this check-only task.'}
(OUT/'human_findings.json').write_text(json.dumps(artifact,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))

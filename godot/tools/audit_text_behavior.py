"""Audit catalog coverage and material declarations; --report writes reviewable evidence.

Run from the repository root. This checks declared semantics and identified sources,
not animation contact or visual acceptance. No motion/playback files are written.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TABLE = ROOT / 'godot/npc/text_behavior/table.json'
DOCS = ROOT / 'docs/behavior-system'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def cell(value):
    return str(value).replace('|', '/').replace('\n', ' ')

def names(text):
    return {m[1] for m in re.finditer(r'^\| `([^`]+)`', text, re.M)}

def line(path, needle):
    for i, text in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if needle in text:
            return f'{path.relative_to(ROOT).as_posix()}:{i}'
    raise AssertionError((path, needle))

def action_ids(t, r):
    use = r.get('use', 'direct')
    if use in ('direct', 'go_use', 'use_tool', 'observe'):
        return r.get('actions', [r.get('action')]), []
    section, key = {
        'pair_once':('pairs','pair'), 'service_customer':('services','service'),
        'service_vendor':('services','service'), 'conversation':('conversations','activity'),
        'object_activity':('object_activities','activity'), 'move_together':('journeys','activity'),
        'event_response':('responses','response'), 'sequence':('processes','process'),
        'transport':('transports','process'), 'support_use':('supports','activity'),
        'connection':('connections','process'), 'current_task':('current_tasks','process')
    }[use]
    d = t[section][r[key]]
    out = []
    def visit(v):
        if isinstance(v, str) and v in t['actions']:
            out.append(v)
        elif isinstance(v, dict):
            for x in v.values(): visit(x)
        elif isinstance(v, list):
            for x in v: visit(x)
    visit(d)
    definitions=[f'{section}.{r[key]}']
    if use == 'support_use':
        pending=list(d.get('compatible',[]))
        seen={r[key]}
        while pending:
            kind=pending.pop(0)
            if kind in seen: continue
            seen.add(kind)
            variant=t['supports'][kind]
            visit(variant)
            definitions.append('supports.'+kind)
            pending.extend(variant.get('compatible',[]))
    if use in ('service_customer','service_vendor') and d.get('queue_connection'):
        if use == 'service_customer':
            out.append(t['connections'][d['queue_connection']]['action'])
            definitions.append('connections.'+d['queue_connection'])
    if use == 'support_use':
        out += ['support_prepare','support_latch','support_release','support_wait']
        if d.get('response'): out.append(d['signal'])
    return list(dict.fromkeys(out)), definitions

REVIEWS = {
    'walk_loaded':'Unbound movement with independently held left/right objects. Empty-hand walking material is never borrowed for this state.',
    'pet_contact':'Missing standing animal-contact clip; requires current dog approach/contact permission and stationary anchor. No humanoid action is assigned to the dog.',
    'wait_current_person':'Standing empty-hand stand_idle, alternating with existing standing check_watch through the current-task action pool. Arrival remains an actual subject event; nervous looking/pace are optional situation-specific materials, not invented anxiety.',
    'select_product':'Unbound standing selection of one actual finite stock item. It is not the completed purchase.',
    'pay_terminal':'Missing phone payment at a declared terminal. Cash-on-counter pay source is not substituted for machine payment.',
    'await_stock_output':'Unbound standing machine/provider wait. Release moves the already-paid existing stock item onto the configured output; elapsed time creates no item.',
    'take_newspaper':'Bound buy_newspaper: standing empty-hand entry, one real paid folded newspaper becomes right-held at assigned native right-hand speed minimum f32. Whole native 70-frame source retained; normal interruptible tail follows the committed pickup. Checkout is separate.',
    'vending_collect':'Bound existing lidded-coffee-CUP retrieval: standing empty entry, actual transaction product cup, right pickup at assigned low forward reversal f39. Added held_coffee_cup/right result setup; provider output already exists before collecting. Whole 70-frame source retained.',
    'draw_container_item':'Missing finite-container draw: RIGHT stack/LEFT empty. Native pictures show LEFT extensions while RIGHT stays beside hip; no visible hand-to-stack draw. Existing whole source is not borrowed for a separate preparation.',
    'offer_sheet':'Unbound RIGHT-stack/LEFT-sheet offer. Native distribute_flyer makes three distinct extensions (f18,83,111–117), not one clear draw/offer/retract. Source text hand claim is wrong; existing RIGHT-stack setup already matches passive hand and is unchanged. A single matched offer source remains needed.',
    'accept_sheet':'Bound existing receive_flyer: standing empty entry, RIGHT hand first forward low-speed pause at assigned f26, then withdraws. Added right held_flyer result attachment. Physical pair contact remains unverified while giver material is missing; this binding identifies the usable receiving-side source.',
    'hold_supply':'Missing standing RIGHT-stack/LEFT-optional holding wait. Empty-hand idle/wait material does not cover this state.',
    'read_book':'Standing source only. Seated use removed; shared seat rise now runs before reading.',
    'sit_sideways':'Unbound: same-name meta describes reclining, not sideways sitting.',
    'walk_umbrella':'Unbound: same-name meta describes a phone beside the ear, despite the umbrella prop in clip-setup.',
    'parcel_terminal':'Unbound: current clip-setup pose defines screen touches, without the retrieval described in the source. Text collect remains explicit.',
    'atm_take_cash':'Unbound: available clip puts cash into a pocket; text process collects a finite item to the hand. Needs matching output/fragment.',
    'pick_up':'Unbound generic collection: existing source picks up one small fruit; arbitrary object shapes are not covered.',
    'interview_listen':'Unbound at the short-answer encounter layout: its existing partner is interview_describe at 1.2 m, versus question/answer at 0.9 m.',
    'sit_down':'Conditional bench transition only. Other seat kinds reference seat_lower; held-object variants are unbound.',
    'stand_up':'Conditional bench transition only. Other seat kinds reference seat_rise; held-object variants are unbound.',
    'seat_lower':'Explicit missing transition for step/chess/cafe seat markers; never binds bench sit_down.',
    'seat_rise':'Explicit missing transition for step/chess/cafe seat markers; never binds bench stand_up.',
    'walk_open_book':'Missing open-book carrying gait; the available walk_hold_front carries a closed book.',
    'give_held':'Generic specified-object giving is unbound; existing give_item supports only its small-object contact contract.',
    'get_up_ground':'Missing ground-to-standing clip; ground posture and can_rise required, never a chair rise.',
    'lie_down':'Missing standing-to-lying transition; lying hold is a different action.',
    'sit_ground_hold':'Missing plain ground-seated hold; sit_ground is the transition.',
    'child_hold_hand_walk':'Missing child-side clip. Adult clip is not reused or scaled for the child.',
    'walk_dog':'Human gait source identified; actual dog and leash coupling/playback remain separate from the text animal adapter.',
    'hang_laundry':'One garment starts held and ends on the rail surface; a once deposit, not an infinite held-clothes loop.',
    'sweep_ground':'Source uses both hands on one broom. Setup attaches the broom to the right hand; two-hand contact is not established by this audit.',
    'mop_ground':'Source uses both hands on one mop. Setup attaches the mop to the right hand; two-hand contact is not established by this audit.',
    'cafe_sit_drink':'Requires an actual cup on the target surface and a cafe seat. Cup returns to the same surface; no tool is invented.',
    'take_tool':'Unbound finite real-item preparation; standing/seated/ground use is explicit text semantics.',
    'stow_item':'Unbound finite real-item preparation; standing/seated/ground use is explicit text semantics.',
    'put_down':'Unbound finite real-item preparation; requires an actual reachable surface and capacity.',
    'give_item':'Small-object source identified; existing cross-counter contact and handoff-frame gaps from report 2 remain.',
    'receive_item':'Empty receiving hand at entry; ownership changes only through the shared joint commit.',
    'handstand':'Inverted palm support only; empty hands. Existing hold source is identified. Entry and interrupted lowering are unbound support transitions, never standing material.',
    'pull_suitcase':'Unbound: the same-name source describes carrying a shopping bag, not pulling a wheeled case.',
    'car_ride':'Unbound passenger seat hold. car_enter/car_exit describe a driver seat and do not cover passenger boarding/exit or this seated hold.',
    'support_prepare':'Unbound standing, empty-hand preparation. Uses shared rise/stow/approach before a support claim; not a mounting animation.',
    'support_latch':'Unbound controlled entry/contact transition across declared poses; follows the profile entry path, not an unrestricted animation.',
    'support_release':'Unbound bounded safe stop/unload. Includes cycling dismount, slide bottom exit, suspension/palm lowering and shared-load release; source hold clips do not cover these transitions.',
    'support_wait':'Unbound waiting at actual posture; not an empty-hand standing clip at arbitrary support.',
    'help_up':'Unbound helper-side shared weight transfer; no help_up source/export exists.',
    'helped_up':'Unbound lying recipient-side weight transfer; no helped_up source/export exists. Ground-seated input has its own unbound action/profile, under the same scored row.',
    'helped_up_ground_seated':'Unbound ground-seated recipient-side weight transfer. Same controller as lying transfer, separate actual pose declaration. No source/export exists.',
    'ride_scooter':'Seated motor scooter source only, both hands on handlebars. Does not cover a standing kick scooter.',
    'pullup_raise':'Hanging source only. Ground-to-bar attachment and lowering are separately unbound; pullup_hold alone does not prove safe entry/exit.',
    'open_fixture':'Unbound standing empty-hand manual route operation. Existing push_door/pull_door require their own provider/side/contact markers; neither is bound at an arbitrary text obstruction. Presence alone never opens this manual door.',
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', action='store_true')
    parser.add_argument('--baseline', type=Path)
    parser.add_argument('--batch',type=int,choices=[3,4,5],default=5)
    parser.add_argument('--scene-baseline',type=Path)
    args = parser.parse_args()
    if args.report and not args.baseline:
        parser.error('--report needs an explicit baseline for the historical authoring-cost ledger')
    t = read(TABLE)
    setups = read(ROOT / 'godot/npc/clip-setup.json')['clips']
    behavior_text = (DOCS / 'behaviors.md').read_text(encoding='utf-8').split('## 4.')[0]
    inventory = names(behavior_text)
    action_inventory = names((DOCS / 'actions.md').read_text(encoding='utf-8'))
    aliases = {'walk':'stroll'}
    internal = {'queue':'service queue', 'serve_customer':'service vendor internal work', 'pass_door':'internal live-portal operation of current movement; never a scored row'}
    assert len(inventory) == 98
    assert not inventory - set(t['rows']) - set(aliases) - set(internal)
    assert not set(t['actions']) - action_inventory, 'actions missing from actions.md: ' + str(set(t['actions'])-action_inventory)
    assert not set(t['rows']) - inventory - {'stroll','idle','adjust_clothes'}
    for key in ['adjust_clothes']:
        assert t['rows'][key]['enabled'] is False
    evidence = []
    for name, a in t['actions'].items():
        assert '?' not in a['label'], ('invalid label', name)
        bindings = {'declared':a.get('clip'), **t.get('bindings',{}).get(name,{})}
        clips = list(dict.fromkeys(v for v in bindings.values() if v is not None))
        sources = []
        for clip in clips:
            path = ROOT / f'assets/animations/npz/{clip}/meta.json'
            motion = ROOT / f'godot/npc/motion/{clip}.json'
            assert path.exists() and motion.exists(), (name,clip,'missing source/export')
            meta = read(path)
            assert meta.get('text'), (clip,'missing source text')
            setup = setups.get(clip,{})
            for kind in ['item','partner']:
                if kind in setup:
                    if kind == 'item':
                        assert (ROOT / f"godot/types/{setup[kind]['type']}.tscn").exists()
                    else:
                        assert (ROOT / f"godot/npc/motion/{setup[kind]['clip']}.json").exists()
            if a['posture'] in ['seated','supported_seated']:
                assert re.search(r'seat|sits|sitting|slouch',meta['text'],re.I), (name,'seated source mismatch')
            if a['posture'] == 'lying':
                assert re.search(r'lying|supine',meta['text'],re.I)
            if setup.get('item') and not a.get('tool'):
                result=a.get('material',{}).get('result',{})
                assert name in ['stand_up','sit_down'] or (a.get('empty') and result.get('hand')==setup['item']['hand'] and result.get('kind') in t['item_kinds']), (name,'prop not declared at input or assigned result')
            if a.get('material'):
                import hashlib
                m=a['material'];assert m['event_status']=='assigned' and m['fps']==30 and 0<=m['effect_frame']<m['frames']
                assert hashlib.sha256((ROOT/f'assets/animations/npz/{clip}/motion.npz').read_bytes()).hexdigest()==m['source_sha256']
                assert m['result']['hand']=='right' and a['posture']=='standing' and a.get('empty')
            if a.get('post') and setup.get('post'):
                assert a['post'] == setup['post'], (name,'post mismatch')
            sources.append({'clip':clip,'meta':path.relative_to(ROOT).as_posix(),'text':meta['text'],'setup':setup,
                            'setup_at':line(ROOT / 'godot/npc/clip-setup.json',f'"{clip}":') if clip in setups else None})
        if name in t.get('bindings',{}):
            assert t['bindings'][name]['held'] is None, (name,'unreviewed held source')
        if a.get('clip') and not a.get('empty') and not a.get('tool'):
            raise AssertionError((name,'unrestricted hand with unconditional source'))
        evidence.append({'id':name,'at':line(TABLE,f'    "{name}": {{'),'declaration':a,'posture':a['posture'],
                         'hand':json.dumps(a['hands'],ensure_ascii=False) if 'hands' in a else a.get('tool','held item' if a.get('holding') else ('empty' if a.get('empty') else 'declared text states; conditional source only')),
                         'bindings':bindings,'sources':sources,
                         'review':REVIEWS.get(name,'Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified.' if clips else 'Explicitly unbound semantic action; do not substitute a similarly named clip.')})
    counts = {'inventory':len(inventory),'rows':len(t['rows']),'enabled':sum(r.get('enabled',True) for r in t['rows'].values()),'actions':len(t['actions'])}
    facts=[]
    for pose,clip in t['external_facts']['fall'].items():
        if clip is not None:
            meta=ROOT / f'assets/animations/npz/{clip}/meta.json'
            assert meta.exists() and (ROOT / f'godot/npc/motion/{clip}.json').exists()
            source=read(meta)['text']
            assert pose != 'lying' or 'back' in source.lower()
            facts.append({'posture':pose,'clip':clip,'meta':meta.relative_to(ROOT).as_posix(),'text':source})
    if args.report:
        baseline = read(args.baseline) if args.baseline else {'rows':{},'actions':{}}
        legacy=[name for name,r in baseline['rows'].items() if r.get('enabled',True)]
        authoring={'previous_enabled':len(legacy),'previous_enabled_unchanged':sum(t['rows'].get(name)==baseline['rows'][name] for name in legacy),
                   'changed_rows':[name for name,r in t['rows'].items() if r != baseline['rows'].get(name)],
                   'changed_existing_actions':[name for name,a in baseline['actions'].items() if a != t['actions'].get(name)],
                   'new_actions':[name for name in t['actions'] if name not in baseline['actions']]}
        if args.batch == 5:
            assert len(legacy)==90 and authoring['previous_enabled_unchanged']==90
            assert set(authoring['changed_rows'])=={'pet_dog','wait_person','buy_newspaper','use_vending','distribute_flyer','receive_flyer'}
            assert not authoring['changed_existing_actions']
            if args.scene_baseline:
                old=read(args.scene_baseline)
                scene=read(ROOT/'godot/scenes/text_behavior_test/demo.json')
                by_id={p['id']:p for p in scene['people']}
                assert all(by_id[p['id']]['tags']==p['tags'] for p in old['people'])
                authoring['personal_coefficients_unchanged']=[p['id'] for p in old['people']]
        rejected={}
        rejected_candidates={'pull_suitcase':['pull_suitcase'],'car_ride':['car_enter','car_exit']}
        if args.batch==5:
            rejected_candidates.update(draw_container_item=['distribute_flyer'],offer_sheet=['distribute_flyer'])
        for action,clips in rejected_candidates.items():
            rejected[action]=[{'clip':clip,'setup':setups.get(clip,{}),'source':read(ROOT / f'assets/animations/npz/{clip}/meta.json')['text'],
                               'reason':REVIEWS[action]} for clip in clips]
        (DOCS / f'asset-audit-{args.batch}.json').write_text(json.dumps({'scope':'Source/declaration audit, not visual acceptance','counts':counts,'authoring_comparison':authoring,'external_facts':facts,'rejected_bindings':rejected,'actions':evidence},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        report = [f'# Batch {args.batch} catalog and authoring audit','',
                  'Every inventory entry is accounted for below. `walk` maps to existing `stroll`; queue, serve_customer and pass_door are internal work, never extra scored rows. `idle` and disabled adjust_clothes are retained implementation entries.','',
                  'Rows were materialized as a batch. The deterministic check removes/re-adds every enabled row and compares all other data. This is a reproducible independent-addition check, not a claim that separate commits or timings were measured.','',
                  f'Unless marked demo.json, row/content locations below are in `godot/npc/text_behavior/table.json`. Shared engine development is charged explicitly in impl-report-{args.batch}.md; the column lists first introductions of shared content definitions, not free engine support.','',
                  '| Row | State / template | Changed content locations | Files for content |','|---|---|---|---|']
        seen_actions = set(baseline['actions'])
        seen_changes = set()
        seen_bindings = set()
        seen_tags = {tag for r in baseline['rows'].values() for tag in r.get('tags',[])}
        seen_definitions = set()
        seen_definition_changes = set()
        for section in ['pairs','services','conversations','object_activities','journeys','responses','processes','transports','supports','connections','current_tasks']:
            seen_definitions.update(f'{section}.{k}' for k in baseline.get(section,{}))
        for name,r in t['rows'].items():
            changed = name not in baseline['rows'] or r != baseline['rows'][name]
            locations = [f'rows.{name}'] if changed else []
            new_tags = []
            state = 'disabled: '+r.get('note','') if not r.get('enabled',True) else r.get('use','direct')
            if r.get('enabled',True):
                actions, defs = action_ids(t,r)
                locations += [f'actions.{x}' for x in actions if x not in seen_actions]
                locations += [f'actions.{x} (shared declaration changed)' for x in actions if x in baseline['actions'] and t['actions'][x] != baseline['actions'][x] and x not in seen_changes]
                locations += [f'bindings.{x}' for x in actions if x in t.get('bindings',{}) and t['bindings'][x] != baseline.get('bindings',{}).get(x) and x not in seen_bindings]
                locations += [x for x in defs if x not in seen_definitions]
                for definition in defs:
                    section,key=definition.split('.',1)
                    if key in baseline.get(section,{}) and t[section][key] != baseline[section][key] and definition not in seen_definition_changes:
                        locations.append(definition+' (shared definition changed)')
                        seen_definition_changes.add(definition)
                seen_actions.update(actions);seen_definitions.update(defs)
                seen_changes.update(actions);seen_bindings.update(actions)
                new_tags = [tag for tag in r.get('tags',[]) if tag not in seen_tags]
                seen_tags.update(new_tags)
                locations += ['demo.json people[*].tags.'+tag+' (first use)' for tag in new_tags]
            report.append(f'| `{name}` | {cell(state)} | '+(', '.join('`'+x+'`' for x in locations) or 'unchanged')+f' | {2 if new_tags else (1 if locations else 0)}; {"existing row revisited" if changed and name in baseline["rows"] else "new row" if changed else "unchanged row"} |')
        report += ['', f'Baseline comparison: {len(legacy)} previously enabled rows; {authoring["previous_enabled_unchanged"]} unchanged. Changed existing actions: '+', '.join(authoring['changed_existing_actions'])+'. Shared engine/preparation costs are charged in the implementation report; table-only content cost does not include that platform work.', '', '| Inventory entry | Coverage |','|---|---|']
        for name in sorted(inventory):
            r = t['rows'].get(aliases.get(name,name))
            state = internal[name] if name in internal else ('enabled: '+aliases.get(name,name) if r.get('enabled',True) else 'disabled: '+r['note'])
            report.append(f'| `{name}` | {cell(state)} |')
        report += ['', '## Each action declaration', '', f'The source text, setup post/prop/partner and exact table line are preserved in asset-audit-{args.batch}.json. A source name proves neither geometry nor playback acceptance.', '', '| Action | Posture / hand | Source binding | Review |','|---|---|---|---|']
        for e in evidence:
            report.append(f'| `{e["id"]}` | {e["posture"]} / {cell(e["hand"])} | {cell(json.dumps(e["bindings"],ensure_ascii=False))} | {cell(e["review"])} |')
        if args.batch == 4:
            scene=read(ROOT / 'godot/scenes/text_behavior_test/demo.json')
            report += ['', '## Batch 4 concrete scene and verification cost','',
                       'Each activated row changes table.json at the locations above. The extra two files below are the real demonstration and deterministic validation work, not per-row engine branches. Common integration also changes system.gd, cooperation.gd, activities.gd, demo.gd, check_text_behavior.gd, one obsolete check_text_behavior_3.gd boundary assertion, scan_text_behavior.gd and audit_text_behavior.py; supports.gd is shared development. services.fruit.queue_connection opts an existing service into the same explicit connection/body-work primitive; no old row declaration changes. Documentation/material audit changes are separately charged in impl-report-4.md. No new preference tag or existing personal coefficient was required.','',
                       '| Activated row | demo.json content | check_text_behavior_4.gd case | Row-specific implementation files |','|---|---|---|---|']
            case={'hold_door':'doors','push_cart':'movers / interruptions / doors','push_stroller':'movers / interruptions / doors','pull_suitcase':'movers',
                  'ride_bicycle':'movers / interruptions / support_conflicts','ride_scooter':'movers / interruptions','hail_taxi':'vehicles','enter_car':'vehicles','exit_car':'vehicles',
                  'assist_person':'shared_weight','accept_assistance':'shared_weight','help_fallen':'shared_weight / support_conflicts','play_seesaw':'mechanisms',
                  'slide_seated':'mechanisms / interruptions','swing_seated':'mechanisms / interruptions','do_pullups':'mechanisms / interruptions','handstand':'mechanisms / interruptions','phone_call':'connections / queued_connection (with existing buy_stuff)'}
            for name in authoring['changed_rows']:
                r=t['rows'][name]
                ids=[id for id,d in scene['devices'].items() if d['profile']==r.get('activity') or name=='exit_car' and d['profile']=='taxi']
                content='calls.scene_call / queue_call + people.Caller + call_endings; services.fruit.queue_connection shared setting' if r['use']=='connection' else 'devices.'+' / devices.'.join(ids)
                if name=='help_fallen': content+='; scheduled_events[0].options can_rise/life; existing Fallen consent'
                report.append(f'| `{name}` | {content} | {case[name]} | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |')
            if args.scene_baseline:
                old=read(args.scene_baseline)
                same=sum(p['tags']==next(q['tags'] for q in scene['people'] if q['id']==p['id']) for p in old['people'])
                report += ['',f'Scene baseline comparison: all {same}/{len(old["people"])} existing personal coefficient maps unchanged; {len(scene["people"])-len(old["people"])} people and {len(scene["devices"])} text devices added. Existing scheduled/manual fall options change in the same JSON file.']
        if args.batch == 5:
            report += ['', '## Batch 5 concrete authoring and scene cost', '',
                       'Six existing disabled entries are enabled. Each row changes table.json, demo.json and check_text_behavior_5.gd: three concrete content/demonstration/check files. Shared engine work is charged once in impl-report-5.md, not hidden in the one-row content claim. The shared walk_loaded preparation declaration is introduced independently of the rows. Standing wait/watch, newspaper, cup and receiving-side sources are bound after native-frame review; remaining material gaps and exact setup data are in asset-audit-5.json.', '',
                       '| Row | Existing executor / new shared definition | Actual scene content | Deterministic case |',
                       '|---|---|---|---|',
                       '| `pet_dog` | work/action_preview; current_tasks.animal_contact | current_tasks.scene_pet; Dog_Petter; animals.Contact_Dog with two permissions | live_tasks |',
                       '| `wait_person` | same current_task adapter | current_tasks.scene_wait; Current_Waiter/Current_Arriver; posts.current_meeting | live_tasks |',
                       '| `buy_newspaper` | existing sequence; processes.newspaper_checkout transaction profile | checkouts.scene_paper; finite_paper; stock/output; Paper_Buyer phone and one authorization | transactions: every stage cut/resume |',
                       '| `use_vending` | same sequence/transaction adapter | checkouts.scene_vend; finite cup; stock/output; Vending_Buyer phone and one authorization | transactions: every stage cut/resume |',
                       '| `distribute_flyer` | existing pair_once; finite_supply optional draw contract | Flyer_Giver right finite_stack; two actual contained paper IDs; transfer_intents.scene_sheet | hands_and_transfer: draw, two held objects, joint cut/resume |',
                       '| `receive_flyer` | same pair_once and atomic transfer | Flyer_Receiver chooses independently; same actual scene_sheet intent | hands_and_transfer: empty receiver, stale/duplicate commit rejection |', '',
                       'Shared implementation changes: system.gd (hand preparation/effect/access), activities.gd (task and sequence checkout adapters), cooperation.gd (optional finite supply and captured-instance cancellation). No row-name dispatch or new per-behavior controller. Shared scene import, check integration, scanner evidence and source audit also changed. Follow-up changes only vending_collect/receive_flyer item attachments in clip-setup; all other clip bytes are unchanged (attachment-diff receipt). No supports.gd, physical model, motion, playback, main scene, memory or CLAUDE file changed.', '']
            if args.scene_baseline:
                report += [f'Scene baseline: {len(authoring["personal_coefficients_unchanged"])}/{len(old["people"])} previous personal coefficient maps unchanged. Seven actors added; all prior90 enabled rows and135 action declarations are identical. Existing tag names are reused; no personal coefficient field was added.', '']
        (DOCS / f'catalog-audit-{args.batch}.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
    print('TEXT_BEHAVIOR_AUDIT_OK '+json.dumps(counts,sort_keys=True))

if __name__ == '__main__': main()

/**
 * NpcPropManager — lifecycle manager for NPC visual props.
 *
 * Each frame:
 *   1. Scans all NPCs' active modifiers to decide which props should be visible.
 *   2. Creates/activates/deactivates prop instances lazily (one prop per type per NPC).
 *   3. Calls update() then draw() on active props.
 *
 * The manager is ticked from StreetScene.update() and drawn after EntityManager.draw().
 */

import { PhoneProp } from './PhoneProp.js';
import { CigaretteProp } from './CigaretteProp.js';
import { BagProp } from './BagProp.js';
import { LeashProp } from './LeashProp.js';

const MODIFIER_TO_PROP = {
  phone_look: 'phone',
  phone_call: 'phone',
  smoke:      'cigarette',
  hold_bag:   'bag',
};

export class NpcPropManager {
  constructor(entityManager) {
    this.em = entityManager;
    this._props = new Map();
  }

  _key(npc, type) { return `${npc.id}:${type}`; }

  _getOrCreate(npc, type) {
    const k = this._key(npc, type);
    let prop = this._props.get(k);
    if (prop) return prop;
    switch (type) {
      case 'phone':     prop = new PhoneProp(npc); break;
      case 'cigarette': prop = new CigaretteProp(npc); break;
      case 'bag':       prop = new BagProp(npc); break;
      default: return null;
    }
    this._props.set(k, prop);
    return prop;
  }

  registerLeash(owner, dog) {
    const k = this._key(owner, 'leash');
    const prop = new LeashProp(owner, dog);
    prop.activate();
    this._props.set(k, prop);
    return prop;
  }

  update(dt) {
    const activeKeys = new Set();

    for (const e of this.em.entities) {
      if (!e.alive || !e.renderer) continue;

      for (const m of (e.modifiers || [])) {
        const propType = MODIFIER_TO_PROP[m.id];
        if (!propType) continue;
        const prop = this._getOrCreate(e, propType);
        if (!prop) continue;
        if (!prop.active) prop.activate();
        activeKeys.add(this._key(e, propType));
      }
    }

    for (const [k, prop] of this._props) {
      if (k.endsWith(':leash')) {
        prop.update(dt);
        continue;
      }
      if (!activeKeys.has(k) && prop.active) {
        prop.deactivate();
      }
      if (prop.active) prop.update(dt);
    }
  }

  /**
   * 返回活跃道具的轻量可绘制包装 {_sortY, draw}，供与场景实体混合统一 Y 排序。
   * 排序键用宿主 NPC 的地面接触 Y（_sortY ?? y），与实体一致。
   */
  getDrawables() {
    const out = [];
    for (const prop of this._props.values()) {
      if (!prop.active) continue;
      if (!prop.npc.alive || !prop.npc.visible) continue;
      out.push({ _sortY: prop.npc._sortY ?? prop.npc.y, draw: (g) => prop.draw(g) });
    }
    return out;
  }

  draw(g) {
    const list = this.getDrawables();
    list.sort((a, b) => a._sortY - b._sortY);
    for (const d of list) d.draw(g);
  }
}

import { setState }         from '../BaseStateMachine.js';
import { Activity }         from './Activity.js';
import { registerActivity } from '../ActivityRegistry.js';

export class DogWalkActivity extends Activity {
  constructor(id, owner, dog) {
    super(id, 'dog_walk');
    this.owner = owner;
    this.dog   = dog;
    this.subState = 'walking';
    this.join(owner, 'owner');
    this.join(dog, 'dog');
    setState(owner, 'walk', 'dog-walk');
  }

  update(dt) {
    if (!this.owner.alive || !this.dog.alive) return false;
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.owner.alive) setState(this.owner, 'walk', 'activity-end');
    super.destroy();
  }
}

registerActivity('dog_walk', (id, participants) => {
  const owner = participants.find(p => p.role === 'owner').npc;
  const dog   = participants.find(p => p.role === 'dog').npc;
  return new DogWalkActivity(id, owner, dog);
});

import { Box3, Group, InstancedMesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { RIG } from '../lib/towers';
import { addRig } from './rig';

const bounds = (parent: Group) => {
  parent.updateMatrixWorld(true);
  return new Box3().setFromObject(parent, true);
};

describe('addRig', () => {
  it('stands on the point it is placed at, at the size it is given', () => {
    const city = new Group();
    addRig(city, 0.5).place(3, 2, -1);
    const box = bounds(city);
    expect(box.min.y).toBeCloseTo(2, 1);
    expect(box.max.y).toBeCloseTo(2 + (RIG.beacon[2] + 0.06) * 0.5, 1);
    expect(box.max.x).toBeCloseTo(3 + 2.9 * 0.5, 1);
  });

  it('swings the jib around the mast and leaves the steel where it is', () => {
    const city = new Group();
    const rig = addRig(city, 1);
    const [steel, mast, jib] = city.children[0].children;
    const tip = () => bounds(city).max.x;
    rig.update(0);
    const rest = tip();
    rig.update(26 / 4);
    expect(jib.rotation.y).toBeCloseTo(0.4, 5);
    expect(tip()).toBeLessThan(rest);
    expect(steel.rotation.y).toBe(0);
    expect(mast.rotation.y).toBe(0);
  });

  it('draws every beam from end to end', () => {
    const city = new Group();
    addRig(city, 1);
    const steel = city.children[0].children[0] as InstancedMesh;
    expect(steel.count).toBe(RIG.steel.length);
    const size = new Box3().setFromObject(steel, true).getSize(new Vector3());
    // A plot wide and two floors high, plus the thickness of the steel.
    expect(size.x).toBeCloseTo(1.05, 2);
    expect(size.y).toBeCloseTo(1.225, 2);
  });

  it('leaves nothing behind when disposed', () => {
    const city = new Group();
    addRig(city, 1).dispose();
    expect(city.children).toHaveLength(0);
  });
});

// The rig on today's roof in 3D: the beams of RIG in lib/towers.ts as thin boxes, so it matches the SVG card, with a
// jib that really turns. Unlit, since it is the one thing in the city that is not a building.
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { RIG, type Beam, type V } from '../lib/towers';
import type { Palette } from './common';

const STEEL = 0.05;
const CRANE = 0.075;
const WEIGHT = 0.2;
const SLEW = 0.4; // radians either side of rest, the same swing as the card
const SLEW_S = 26;
const BLINK_S = 2.6;

export interface Rig {
  /** Stand it on a roof, in the city's coordinates. */
  place: (x: number, y: number, z: number) => void;
  update: (seconds: number) => void;
  paint: (palette: Palette) => void;
  dispose: () => void;
}

/** Scenes have y up. */
const scenePoint = ([x, y, z]: V) => new Vector3(x, z, y);

/** A plot's worth of rig, sized by `scale`, added to `parent`. */
export function addRig(parent: Group, scale: number): Rig {
  const box = new BoxGeometry(1, 1, 1);
  const dot = new SphereGeometry(0.06, 10, 8);
  const steelMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.75 });
  const craneMaterial = new MeshBasicMaterial();
  const beaconMaterial = new MeshBasicMaterial();

  const dummy = new Object3D();
  const along = new Vector3(0, 0, 1);
  const beams = (list: Beam[], material: MeshBasicMaterial, thickness: number) => {
    const mesh = new InstancedMesh(box, material, list.length);
    list.forEach((beam, i) => {
      const [a, b] = beam.map(scenePoint);
      const length = a.distanceTo(b);
      dummy.position.copy(a).lerp(b, 0.5);
      dummy.quaternion.setFromUnitVectors(along, b.clone().sub(a).normalize());
      dummy.scale.set(thickness, thickness, length);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    return mesh;
  };

  const rig = new Group();
  rig.scale.setScalar(scale);
  const jib = new Group();
  jib.add(beams(RIG.jib, craneMaterial, CRANE), beams(RIG.weights, craneMaterial, WEIGHT));
  const beacon = new Mesh(dot, beaconMaterial);
  beacon.position.copy(scenePoint(RIG.beacon));
  rig.add(beams(RIG.steel, steelMaterial, STEEL), beams([RIG.mast], craneMaterial, CRANE), jib, beacon);
  parent.add(rig);

  let signal: Palette['signal'] | null = null;
  return {
    place: (x, y, z) => rig.position.set(x, y, z),
    update: (seconds) => {
      jib.rotation.y = Math.sin((seconds / SLEW_S) * Math.PI * 2) * SLEW;
      const pulse = 0.5 + 0.5 * Math.cos((seconds / BLINK_S) * Math.PI * 2);
      if (signal) beaconMaterial.color.copy(signal).multiplyScalar(0.15 + pulse * 1.1);
    },
    paint: (palette) => {
      signal = palette.signal;
      // Under the bloom threshold at night, so the steel stays quiet and only the beacon glows.
      steelMaterial.color.copy(palette.signal).multiplyScalar(palette.night ? 0.45 : 1);
      craneMaterial.color.copy(palette.signal).multiplyScalar(palette.night ? 0.55 : 1);
      beaconMaterial.color.copy(palette.signal);
    },
    dispose: () => {
      parent.remove(rig);
      rig.traverse((node) => {
        if (node instanceof InstancedMesh) node.dispose();
      });
      box.dispose();
      dot.dispose();
      steelMaterial.dispose();
      craneMaterial.dispose();
      beaconMaterial.dispose();
    },
  };
}

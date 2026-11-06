// The buildings in 3D: the catalog in lib/towers.ts as one instanced mesh per shape, addressed by tower index so a
// scene can treat a whole city as one list. Faces stay flat shaded, with a normal per face, and sides are darkened
// like the SVG card's, or the bright neon washes the setbacks of a tower together. Materials need `vertexColors`.
import { BufferAttribute, BufferGeometry, InstancedMesh, type Color, type Material, type Matrix4 } from 'three';
import { complexFaces, type Complex } from '../lib/complexes';
import { towerFaces, type Face, type TowerStyle } from '../lib/towers';

const SHADE: Record<Face['kind'], number> = { cap: 1, right: 0.78, front: 0.58 };

/** A building from the catalog, or a complex, which has a shape of its own. */
export type Building = TowerStyle | Complex;

/** A building in a 1 by 1 by 1 box, standing on y = `floor`. */
export function towerGeometry(building: Building, floor = 0): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (const { points, normal, kind } of typeof building === 'string' ? towerFaces(building) : complexFaces(building)) {
    // Scenes have y up. Swapping two axes mirrors the shape, so each fan runs the other way round to still face out.
    const [first, ...rest] = points;
    for (let i = rest.length - 1; i > 0; i--) {
      for (const [x, y, z] of [first, rest[i], rest[i - 1]]) {
        positions.push(x, z + floor, y);
        normals.push(normal[0], normal[2], normal[1]);
        colors.push(SHADE[kind], SHADE[kind], SHADE[kind]);
      }
    }
  }
  return new BufferGeometry()
    .setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    .setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
    .setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
}

export interface TowerMeshes {
  meshes: InstancedMesh[];
  setMatrixAt: (index: number, matrix: Matrix4) => void;
  setColorAt: (index: number, color: Color) => void;
  /** Call after a round of setMatrixAt. */
  placed: () => void;
  /** Call after a round of setColorAt. */
  painted: () => void;
  dispose: () => void;
}

interface MeshOptions {
  /** Where the floor of each shape sits, for a scene that places towers by their centre. */
  floor?: number;
  /** Add per-instance attributes to a shape, given which towers it holds. */
  dress?: (geometry: BufferGeometry, towers: number[]) => void;
}

/** Instanced meshes for a list of towers, one per shape in use. */
export function towerMeshes(buildings: Building[], material: Material, { floor = 0, dress }: MeshOptions = {}): TowerMeshes {
  const shapes = new Map<Building, number[]>();
  buildings.forEach((building, i) => {
    const towers = shapes.get(building);
    if (towers) towers.push(i);
    else shapes.set(building, [i]);
  });

  // Where each tower lives: its mesh, and its instance in that mesh.
  const slots: [InstancedMesh, number][] = [];
  const meshes = [...shapes].map(([building, towers]) => {
    const geometry = towerGeometry(building, floor);
    dress?.(geometry, towers);
    const mesh = new InstancedMesh(geometry, material, towers.length);
    towers.forEach((tower, slot) => (slots[tower] = [mesh, slot]));
    return mesh;
  });

  return {
    meshes,
    setMatrixAt: (index, matrix) => slots[index][0].setMatrixAt(slots[index][1], matrix),
    setColorAt: (index, color) => slots[index][0].setColorAt(slots[index][1], color),
    placed: () => {
      for (const mesh of meshes) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    },
    painted: () => {
      for (const mesh of meshes) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose: () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
    },
  };
}

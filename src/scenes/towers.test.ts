import { Color, Matrix4, MeshBasicMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { TOWER_NAMES, type TowerStyle } from '../lib/towers';
import { towerGeometry, towerMeshes } from './towers';

const STYLES = ['block', 'setback', ...Object.keys(TOWER_NAMES)] as TowerStyle[];

describe('towerGeometry', () => {
  it.each(STYLES)('%s winds every triangle to face the way its normal does', (style) => {
    const geometry = towerGeometry(style);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const [a, b, c, n] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    expect(position.count % 3).toBe(0);
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      n.fromBufferAttribute(normal, i);
      expect(b.clone().sub(a).cross(c.clone().sub(a)).dot(n)).toBeGreaterThan(0);
    }
  });

  it('stands a block on the floor it is given, y up', () => {
    const box = (floor?: number) => {
      const geometry = towerGeometry('block', floor);
      geometry.computeBoundingBox();
      return geometry.boundingBox!;
    };
    expect([box().min.y, box().max.y]).toEqual([0, 1]);
    expect([box(-0.5).min.y, box(-0.5).max.y]).toEqual([-0.5, 0.5]);
    expect([box().min.x, box().max.x]).toEqual([-0.5, 0.5]);
  });

  it('darkens the sides of a building and leaves its roof at full color', () => {
    const geometry = towerGeometry('block');
    const color = geometry.getAttribute('color');
    const normal = geometry.getAttribute('normal');
    for (let i = 0; i < color.count; i++) {
      if (normal.getY(i) === 1) expect(color.getX(i)).toBe(1);
      else expect(color.getX(i)).toBeLessThan(1);
    }
  });
});

describe('towerMeshes', () => {
  const styles: TowerStyle[] = ['block', 'burj', 'block', 'eiffel', 'burj'];

  it('makes one mesh per shape, with room for its towers', () => {
    const { meshes } = towerMeshes(styles, new MeshBasicMaterial());
    expect(meshes.map((m) => m.count).sort()).toEqual([1, 2, 2]);
  });

  it('finds a tower by its index in the list', () => {
    const towers = towerMeshes(styles, new MeshBasicMaterial());
    towers.setMatrixAt(4, new Matrix4().makeTranslation(7, 0, 0));
    towers.setColorAt(4, new Color(1, 0, 0));
    const burj = towers.meshes[1];
    const matrix = new Matrix4();
    burj.getMatrixAt(1, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).x).toBe(7);
    const color = new Color();
    burj.getColorAt(1, color);
    expect(color.r).toBe(1);
  });

  it('dresses each shape with the towers it holds', () => {
    const held: number[][] = [];
    towerMeshes(styles, new MeshBasicMaterial(), { dress: (_, towers) => held.push(towers) });
    expect(held).toEqual([[0, 2], [1, 4], [3]]);
  });

  it('copes with an empty city', () => {
    expect(towerMeshes([], new MeshBasicMaterial()).meshes).toEqual([]);
  });
});

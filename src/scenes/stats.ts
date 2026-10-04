// The 3D project stats city for /stats: one lane of towers per metric, one column per day. Every lane is scaled
// to its own peak, like small multiples, since views and stars live on very different scales. Exact numbers are
// in the hover readout and the table on the page. Same look as the skyline: neon towers, bloom, a scanner beam.
import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface Lane {
  label: string;
  values: (number | null)[];
}

export interface Hit {
  lane: number;
  day: number;
}

interface Options {
  onHover: (hit: Hit | null) => void;
  onReady: () => void;
  /** One element per lane, kept beside the lane's left end. */
  laneLabels: HTMLElement[];
  /** Kept under the first and last day of the front lane. */
  dateLabels: [HTMLElement, HTMLElement];
  /** Floats over the hovered tower. */
  tag: HTMLElement;
  formatTag: (hit: Hit) => string;
}

const GAP = 0.8;
const MAX_H = 5;
const RISE_MS = 1400;
const SWEEP_MS = 5200;

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => new Color(css.getPropertyValue(name).trim() || '#000');
  const surface = token('--surface');
  const raised = token('--raised');
  return {
    surface,
    raised,
    missing: new Color().lerpColors(surface, raised, 0.5),
    data: token('--data'),
    peak: token('--peak'),
    signal: token('--accent'),
    night: surface.r * 0.2126 + surface.g * 0.7152 + surface.b * 0.0722 < 0.4,
  };
}

export function mountStats(host: HTMLElement, lanes: Lane[], opts: Options): () => void {
  const days = lanes[0]?.values.length ?? 0;
  if (!days) return () => {};
  const narrow = host.clientWidth < 600;
  const LANE = narrow ? 3 : 1.9;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Per lane: its peak, and the one day that gets the neon green peak color when the lane is not flat.
  const scales = lanes.map(({ values }) => {
    const known = values.filter((v): v is number => v !== null);
    const max = Math.max(0, ...known);
    const flat = known.every((v) => v === known[0]);
    return { max, peak: max > 0 && !flat ? values.lastIndexOf(max) : -1 };
  });
  const cells = lanes.flatMap((lane, l) => lane.values.map((value, d) => ({ l, d, value })));

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const fog = new Fog(0x000000, 70, 160);
  scene.fog = fog;
  const camera = new PerspectiveCamera(30, 1, 1, 400);
  scene.add(new AmbientLight(0xffffff, 1.1));
  const key = new DirectionalLight(0xffffff, 1.8);
  key.position.set(10, 18, 8);
  const fill = new DirectionalLight(0xffffff, 0.4);
  fill.position.set(-12, 6, -10);
  scene.add(key, fill);

  const city = new Group();
  scene.add(city);

  const uniforms = { uGlow: { value: 0.22 }, uBeamX: { value: -999 }, uBeamColor: { value: new Color() } };
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.25 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vCityX;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
        vec4 cityPos = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          cityPos = instanceMatrix * cityPos;
        #endif
        vCityX = cityPos.x;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vCityX;\nuniform float uGlow;\nuniform float uBeamX;\nuniform vec3 uBeamColor;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          totalEmissiveRadiance += vColor.rgb * uGlow;
        #endif
        totalEmissiveRadiance += uBeamColor * smoothstep( 1.4, 0.0, abs( vCityX - uBeamX ) );`,
      );
  };
  const mesh = new InstancedMesh(geometry, material, cells.length);
  city.add(mesh);

  // Columns share a fixed footprint, so 4 days and 90 days both read as a city rather than a sliver or a strip.
  // A phone gets a narrower one, wider lanes and a higher camera, so the lanes stay far enough apart to label.
  const col = Math.min(3, Math.max(0.5, (narrow ? 22 : 44) / days));
  const width = Math.min(col * GAP, 1.6);
  const cityWidth = days * col;
  const x = (d: number) => (d - (days - 1) / 2) * col;
  const z = (l: number) => (l - (lanes.length - 1) / 2) * LANE;

  const span = Math.ceil(Math.max(cityWidth, lanes.length * LANE) + 12);
  const grid = new GridHelper(span, span);
  const gridMaterial = grid.material as LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.depthWrite = false;
  grid.position.y = -0.01;
  city.add(grid);

  const beamMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false });
  const beam = new Mesh(new PlaneGeometry(0.12, lanes.length * LANE + 1), beamMaterial);
  beam.rotation.x = -Math.PI / 2;
  beam.position.y = 0.05;
  beam.visible = false;
  city.add(beam);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.3, 0.62));
  composer.addPass(new OutputPass());

  let night = true;
  const paint = () => {
    const p = readPalette();
    night = p.night;
    // Unlike the skyline, every lane can have a peak, so they are not boosted for bloom.
    const peak = p.peak;
    const tint = new Color();
    cells.forEach(({ l, d, value }, i) => {
      const { max, peak: peakDay } = scales[l];
      if (value === null) mesh.setColorAt(i, p.missing);
      else if (d === peakDay) mesh.setColorAt(i, peak);
      else if (value === 0 || !max) mesh.setColorAt(i, p.raised);
      else mesh.setColorAt(i, tint.lerpColors(p.raised, p.data, 0.35 + 0.65 * (value / max)));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.background = p.surface;
    fog.color.copy(p.surface);
    uniforms.uGlow.value = night ? 0.22 : 0;
    uniforms.uBeamColor.value.copy(p.signal).multiplyScalar(night ? 0.85 : 0.5);
    gridMaterial.color.copy(p.signal);
    gridMaterial.opacity = night ? 0.1 : 0.07;
    beamMaterial.color.copy(p.signal);
    beamMaterial.blending = night ? AdditiveBlending : NormalBlending;
    render();
  };

  const height = (l: number, value: number | null) => {
    const { max } = scales[l];
    if (!value || !max) return 0.04;
    return 0.15 + (value / max) * MAX_H;
  };
  const dummy = new Object3D();
  const place = (progress: (d: number) => number) => {
    cells.forEach(({ l, d, value }, i) => {
      const h = Math.max(0.04, height(l, value) * progress(d));
      dummy.position.set(x(d), h / 2, z(l));
      dummy.scale.set(width, h, GAP);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableZoom: false,
    enablePan: false,
    minPolarAngle: 0.35,
    maxPolarAngle: 1.3,
    minAzimuthAngle: -0.9,
    maxAzimuthAngle: 0.9,
  });
  controls.target.set(0, 1.2, 0);
  renderer.domElement.style.touchAction = 'pan-y';

  // HTML labels pinned to points in the city, projected every frame since the city rises, sways and orbits.
  const pins: [HTMLElement, Vector3][] = [
    ...opts.laneLabels.map((el, l) => [el, new Vector3(x(0) - width / 2 - 0.8, 0, z(l))] as [HTMLElement, Vector3]),
    [opts.dateLabels[0], new Vector3(x(0), 0, z(lanes.length - 1) + 1.4)],
    [opts.dateLabels[1], new Vector3(x(days - 1), 0, z(lanes.length - 1) + 1.4)],
  ];
  const point = new Vector3();
  const roof = new Vector3();
  const toScreen = (el: HTMLElement, local: Vector3) => {
    point.copy(local).applyMatrix4(city.matrixWorld).project(camera);
    el.style.transform = `translate(${((point.x + 1) / 2) * host.clientWidth}px, ${((1 - point.y) / 2) * host.clientHeight}px)`;
  };
  function placePins() {
    city.updateMatrixWorld();
    for (const [el, local] of pins) toScreen(el, local);
    const cell = cells[hovered];
    if (!cell || cell.value === null) {
      opts.tag.hidden = true;
      return;
    }
    opts.tag.textContent = opts.formatTag({ lane: cell.l, day: cell.d });
    toScreen(opts.tag, roof.set(x(cell.d), height(cell.l, cell.value), z(cell.l)));
    opts.tag.hidden = false;
  }

  function render() {
    if (night) composer.render();
    else renderer.render(scene, camera);
    placePins();
  }

  // Fit the whole city across the width. The lane labels on the left are a fixed size in pixels, so their room is too.
  const fit = () => {
    const room = Math.min(0.5, Math.max(0.22, 180 / host.clientWidth));
    const halfWidth = (cityWidth / 2 + 1) / (1 - room);
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const distance = Math.max(halfWidth / (tanV * camera.aspect), (lanes.length * LANE + MAX_H) / tanV / 1.4);
    camera.position
      .copy(new Vector3(0, narrow ? 0.85 : 0.7, narrow ? 0.55 : 0.72).normalize().multiplyScalar(distance))
      .add(controls.target);
    controls.update();
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
    render();
  };

  const ray = new Raycaster();
  const pointer = new Vector2();
  let hovered = -1;
  const onPointerMove = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(mesh)[0]?.instanceId ?? -1;
    if (hit === hovered) return;
    hovered = hit;
    opts.onHover(hit >= 0 ? { lane: cells[hit].l, day: cells[hit].d } : null);
    render();
  };
  const onPointerLeave = () => {
    hovered = -1;
    opts.onHover(null);
    render();
  };
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);

  let frame = 0;
  let visible = true;
  let start = -1;
  let risen = reduced;
  const reach = cityWidth / 2 + 1;
  const tick = (now: number) => {
    frame = 0;
    if (!visible) return;
    if (start < 0) start = now;
    const t = (now - start) / RISE_MS;
    if (!risen) {
      // Days rise left to right, each easing out.
      place((d) => {
        const local = Math.min(1, Math.max(0, t * 1.6 - (d / Math.max(1, days - 1)) * 0.6));
        return 1 - Math.pow(1 - local, 3);
      });
      if (t >= 1) risen = true;
    }
    if (!reduced) {
      city.rotation.y = Math.sin((now / 1000) * 0.18) * 0.18;
      const phase = risen ? ((((now - start - RISE_MS) % SWEEP_MS) + SWEEP_MS) % SWEEP_MS) / (SWEEP_MS * 0.6) : 2;
      beam.visible = phase <= 1;
      beam.position.x = -reach + phase * reach * 2;
      uniforms.uBeamX.value = beam.visible ? beam.position.x : -999;
    }
    render();
    if (!reduced || !risen) frame = requestAnimationFrame(tick);
  };
  const play = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  controls.addEventListener('change', () => (reduced ? render() : play()));

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) play();
  });
  io.observe(host);

  const media = matchMedia('(prefers-color-scheme: light)');
  media.addEventListener('change', paint);
  const themeObserver = new MutationObserver(paint);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  place(() => (reduced ? 1 : 0));
  paint();
  resize();
  play();
  requestAnimationFrame(opts.onReady);

  return () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    io.disconnect();
    themeObserver.disconnect();
    media.removeEventListener('change', paint);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    controls.dispose();
    composer.dispose();
    geometry.dispose();
    material.dispose();
    gridMaterial.dispose();
    grid.geometry.dispose();
    beam.geometry.dispose();
    beamMaterial.dispose();
    mesh.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

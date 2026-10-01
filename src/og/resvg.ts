import { initWasm, Resvg } from '@resvg/resvg-wasm';

export interface RasterAssets {
  /** The resvg wasm, as a compiled module (Workers) or raw bytes (Node). */
  wasm: WebAssembly.Module | BufferSource;
  fonts: ArrayBuffer[];
}

let ready: Promise<void> | null = null;

/** SVG string to PNG bytes. Fonts must be TTF or OTF, and the SVG must only use families they provide. */
export async function rasterize(svg: string, assets: RasterAssets, width = 1200): Promise<Uint8Array> {
  ready ??= initWasm(assets.wasm).catch((err: unknown) => {
    // Hot reload in dev can import this module twice against one wasm instance.
    if (!String(err).includes('Already initialized')) {
      ready = null;
      throw err;
    }
  });
  await ready;
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontBuffers: assets.fonts.map((f) => new Uint8Array(f)),
      loadSystemFonts: false,
      defaultFontFamily: 'JetBrains Mono',
    },
  });
  const image = resvg.render();
  const png = image.asPng();
  image.free();
  resvg.free();
  return png;
}

import { useRef, useEffect } from "react";

interface SineWaveGridProps {
  frozen?: boolean;
  gridSize?: number;
  radius?: number;
  opacity?: number;
  maxCellSizePct?: number;
  sampleImageUrl?: string;
}

const TAU = Math.PI * 2;
const WAVE_COUNT = 6;
const PURPLE_WAVE_COUNT = 3;
const TOTAL_WAVE_COUNT = WAVE_COUNT + PURPLE_WAVE_COUNT;
const SPEED = 1.5;

const PURPLE = [138 / 255, 75 / 255, 207 / 255]; // purple-500
const GREY = [120 / 255, 120 / 255, 120 / 255];

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

const float TAU = ${TAU};
const int WAVE_COUNT = ${WAVE_COUNT};
const int TOTAL_WAVE_COUNT = ${TOTAL_WAVE_COUNT};

uniform vec2 u_size;       // CSS pixels
uniform vec2 u_pixelSize;  // device pixels
uniform vec2 u_grid;       // cols, rows
uniform float u_time;
uniform float u_radius;
uniform float u_maxCellSizePct;
uniform float u_jitter;
uniform bool u_frozen;
uniform vec3 u_baseColor;
// xy = direction (cos, sin), z = speed, w = phase
uniform vec4 u_waves[TOTAL_WAVE_COUNT];
uniform bool u_hasSample;
uniform sampler2D u_sample;
uniform vec2 u_sampleSize;

float wave(vec4 w, vec2 cell) {
  return sin(dot(cell, w.xy) * TAU * 0.1 + u_time * w.z + w.w);
}

// Bilinear sample of the preview image, cover-fit to the canvas
vec3 sampleColor(vec2 p) {
  float canvasRatio = u_size.x / u_size.y;
  float imageRatio = u_sampleSize.x / u_sampleSize.y;
  vec2 visible = canvasRatio > imageRatio
    ? vec2(1.0, imageRatio / canvasRatio)
    : vec2(canvasRatio / imageRatio, 1.0);
  vec2 imagePos = ((p / u_size - 0.5) * visible + 0.5) * u_sampleSize;
  imagePos = clamp(imagePos, vec2(0.0), u_sampleSize - 1.0);
  vec3 color = texture2D(u_sample, (imagePos + 0.5) / u_sampleSize).rgb;
  return u_frozen ? vec3(dot(color, vec3(0.299, 0.587, 0.114))) : color;
}

// Premultiplied color of the given cell's rounded square at point p
vec4 cellColor(vec2 cell, vec2 p, vec2 cellSize, float pixel) {
  float combinedWave = 0.0;
  for (int i = 0; i < WAVE_COUNT; i++) {
    combinedWave += wave(u_waves[i], cell);
  }
  float normalizedWave = (combinedWave / float(WAVE_COUNT) + 1.0) / 2.0;

  float squareSize = min(
    cellSize.x,
    cellSize.x * (u_jitter * 0.2 + normalizedWave * 0.4 + 0.4) * u_maxCellSizePct
  );
  vec2 center = (cell + 0.5) * cellSize;
  vec2 halfSize = vec2(squareSize * cellSize.x / cellSize.y, squareSize) / 2.0;
  vec2 rectCenter = center - squareSize / 2.0 + halfSize;

  // Rounded box SDF; radius clamps to a pill like canvas roundRect does
  float radius = min(u_radius, min(halfSize.x, halfSize.y));
  vec2 q = abs(p - rectCenter) - halfSize + radius;
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float coverage = clamp(0.5 - dist / pixel, 0.0, 1.0);
  if (coverage <= 0.0) return vec4(0.0);

  float purpleWave = 0.0;
  for (int i = WAVE_COUNT; i < TOTAL_WAVE_COUNT; i++) {
    purpleWave += wave(u_waves[i], cell);
  }
  purpleWave /= float(TOTAL_WAVE_COUNT - WAVE_COUNT);

  vec3 sampledOrBase = u_hasSample ? sampleColor(center + purpleWave * 4.0) : u_baseColor;
  float purpleBlend = clamp((purpleWave + 1.0) / 2.0 * 0.45, 0.0, 0.45);
  vec3 color = mix(sampledOrBase, u_baseColor, purpleBlend);

  // Slight color shift based on wave (only for colored version)
  if (!u_frozen) {
    float hueShift = (normalizedWave * 30.0 - 15.0) / 255.0;
    color.r += hueShift;
    color.g -= hueShift * 0.5;
  }
  color = clamp(color, 0.0, 1.0);

  float alpha = u_frozen ? normalizedWave * 0.5 : normalizedWave * 0.7 + u_jitter * 0.3;
  alpha *= coverage;
  return vec4(color * alpha, alpha);
}

void main() {
  vec2 cssPerPixel = u_size / u_pixelSize;
  vec2 p = vec2(gl_FragCoord.x, u_pixelSize.y - gl_FragCoord.y) * cssPerPixel;
  vec2 cellSize = u_size / u_grid;
  vec2 cell = floor(p / cellSize);

  // Squares can spill slightly into neighboring cells, so composite the 3x3
  // neighborhood in row-major draw order
  vec4 result = vec4(0.0);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 neighbor = cell + vec2(float(dx), float(dy));
      if (any(lessThan(neighbor, vec2(0.0))) || any(greaterThanEqual(neighbor, u_grid))) continue;
      vec4 src = cellColor(neighbor, p, cellSize, cssPerPixel.x);
      result = src + result * (1.0 - src.a);
    }
  }
  gl_FragColor = result;
}
`;

const UNIFORM_NAMES = [
  "u_size",
  "u_pixelSize",
  "u_grid",
  "u_time",
  "u_radius",
  "u_maxCellSizePct",
  "u_jitter",
  "u_frozen",
  "u_baseColor",
  "u_waves",
  "u_hasSample",
  "u_sample",
  "u_sampleSize",
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

interface GridInstance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  frozen: boolean;
  gridSize: number;
  radius: number;
  maxCellSizePct: number;
  waves: Float32Array;
  jitter: number;
  time: number;
  sampleImage: HTMLImageElement | null;
  texture: WebGLTexture | null;
}

interface Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  uniforms: Record<UniformName, WebGLUniformLocation | null>;
}

// Browsers cap the number of live WebGL contexts (~16), and many loading cards
// can be on screen at once. All grids share one offscreen context: each one is
// rendered there and then copied into its own 2D canvas.
const instances = new Set<GridInstance>();
let renderer: Renderer | null | undefined; // undefined = not created yet, null = unsupported
let frameId = 0;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("SineWaveGrid shader error:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initGl(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("SineWaveGrid program error:", gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  // Single triangle covering the whole viewport
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = Object.fromEntries(
    UNIFORM_NAMES.map((name) => [name, gl.getUniformLocation(program, name)])
  ) as Renderer["uniforms"];
  gl.uniform1i(uniforms.u_sample, 0);
  return uniforms;
}

function getRenderer() {
  if (renderer !== undefined) return renderer;

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { antialias: false, depth: false });
  const uniforms = gl && initGl(gl);
  if (!gl || !uniforms) return (renderer = null);

  const created: Renderer = { canvas, gl, uniforms };
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => {
    const restored = initGl(gl);
    if (restored) created.uniforms = restored;
    for (const instance of instances) instance.texture = null;
  });
  return (renderer = created);
}

function createWaves() {
  const waves = new Float32Array(TOTAL_WAVE_COUNT * 4);
  for (let i = 0; i < TOTAL_WAVE_COUNT; i++) {
    // direction is a random angle in radians, speed determines how fast the wave moves, phase determines the starting point
    const direction = Math.random() * TAU;
    const speed = (Math.random() * 2.5 + 0.2) * SPEED;
    const phase = Math.random() * TAU;
    waves.set([Math.cos(direction), Math.sin(direction), speed, phase], i * 4);
  }
  return waves;
}

function setSampleImage(instance: GridInstance, image: HTMLImageElement | null) {
  if (instance.texture) renderer?.gl.deleteTexture(instance.texture);
  instance.texture = null;
  instance.sampleImage = image;
}

function drawInstance({ canvas: glCanvas, gl, uniforms }: Renderer, instance: GridInstance) {
  const { canvas, ctx } = instance;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;

  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  // The shared canvas only grows; each instance renders into its bottom-left corner
  if (glCanvas.width < pixelWidth) glCanvas.width = pixelWidth;
  if (glCanvas.height < pixelHeight) glCanvas.height = pixelHeight;

  const { sampleImage } = instance;
  if (sampleImage && !instance.texture) {
    instance.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, instance.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sampleImage);
  }
  const hasSample = Boolean(sampleImage && instance.texture);
  if (hasSample) gl.bindTexture(gl.TEXTURE_2D, instance.texture);

  const cols = instance.gridSize;
  const rows = Math.ceil((height / width) * cols) || cols;

  gl.uniform2f(uniforms.u_size, width, height);
  gl.uniform2f(uniforms.u_pixelSize, pixelWidth, pixelHeight);
  gl.uniform2f(uniforms.u_grid, cols, rows);
  gl.uniform1f(uniforms.u_time, instance.time);
  gl.uniform1f(uniforms.u_radius, instance.radius);
  gl.uniform1f(uniforms.u_maxCellSizePct, instance.maxCellSizePct);
  gl.uniform1f(uniforms.u_jitter, instance.jitter);
  gl.uniform1i(uniforms.u_frozen, instance.frozen ? 1 : 0);
  gl.uniform3fv(uniforms.u_baseColor, instance.frozen ? GREY : PURPLE);
  gl.uniform4fv(uniforms.u_waves, instance.waves);
  gl.uniform1i(uniforms.u_hasSample, hasSample ? 1 : 0);
  if (sampleImage) {
    gl.uniform2f(
      uniforms.u_sampleSize,
      sampleImage.naturalWidth || sampleImage.width,
      sampleImage.naturalHeight || sampleImage.height
    );
  }

  gl.viewport(0, 0, pixelWidth, pixelHeight);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.drawImage(
    glCanvas,
    0,
    glCanvas.height - pixelHeight,
    pixelWidth,
    pixelHeight,
    0,
    0,
    pixelWidth,
    pixelHeight
  );
}

function renderFrame() {
  frameId = requestAnimationFrame(renderFrame);

  const active = getRenderer();
  if (!active || active.gl.isContextLost()) return;

  for (const instance of instances) {
    drawInstance(active, instance);
    if (!instance.frozen) instance.time += 0.016; // ~60fps timing
  }
}

function addInstance(instance: GridInstance) {
  instances.add(instance);
  if (instances.size === 1) frameId = requestAnimationFrame(renderFrame);
}

function removeInstance(instance: GridInstance) {
  setSampleImage(instance, null);
  instances.delete(instance);
  if (instances.size === 0) cancelAnimationFrame(frameId);
}

export function SineWaveGrid({
  frozen = false,
  gridSize = 8,
  radius = 0,
  opacity = 1,
  maxCellSizePct = 1,
  sampleImageUrl,
}: SineWaveGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<GridInstance | null>(null);

  // Register with the shared renderer; props are applied by the effect below
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const instance: GridInstance = {
      canvas,
      ctx,
      frozen: false,
      gridSize: 8,
      radius: 0,
      maxCellSizePct: 1,
      waves: createWaves(),
      jitter: Math.random(),
      time: 0,
      sampleImage: null,
      texture: null,
    };
    instanceRef.current = instance;
    addInstance(instance);

    return () => {
      removeInstance(instance);
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    Object.assign(instance, { frozen, gridSize, radius, maxCellSizePct });
  }, [frozen, gridSize, radius, maxCellSizePct]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    setSampleImage(instance, null);
    if (!sampleImageUrl) return;

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;
      if (!(image.naturalWidth || image.width) || !(image.naturalHeight || image.height)) return;
      setSampleImage(instance, image);
    };

    image.src = sampleImageUrl;

    return () => {
      cancelled = true;
    };
  }, [sampleImageUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ imageRendering: "pixelated", opacity }}
    />
  );
}

// The WebGL plumbing: one context, three programs, and the small set of calls the renderer makes.
// Mesh data goes up once and is kept; a draw call sets the model matrix and the material knobs.
import { LIT_VERT, LIT_FRAG, SKY_VERT, SKY_FRAG, WATER_VERT, WATER_FRAG } from './shaders.js';

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    depth: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser');
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0.1, 0.15, 0.24, 1);
  return gl;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

class Program {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    this.handle = gl.createProgram();
    gl.attachShader(this.handle, compile(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(this.handle, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(this.handle);
    if (!gl.getProgramParameter(this.handle, gl.LINK_STATUS)) {
      throw new Error(`program link failed: ${gl.getProgramInfoLog(this.handle)}`);
    }
    this.uniforms = new Map();
    this.types = new Map();
    const count = gl.getProgramParameter(this.handle, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i += 1) {
      const info = gl.getActiveUniform(this.handle, i);
      if (info) this.types.set(info.name, info.type);
    }
  }

  use() {
    this.gl.useProgram(this.handle);
    return this;
  }

  location(name) {
    let loc = this.uniforms.get(name);
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(this.handle, name);
      this.uniforms.set(name, loc);
    }
    return loc;
  }

  mat4(name, value) {
    this.gl.uniformMatrix4fv(this.location(name), false, value);
    return this;
  }

  mat3(name, value) {
    this.gl.uniformMatrix3fv(this.location(name), false, value);
    return this;
  }

  vec3(name, value) {
    const type = this.types.get(name);
    if (type !== undefined && type !== this.gl.FLOAT_VEC3) {
      throw new Error(`uniform ${name} is not a vec3 (type ${type}); value ${JSON.stringify(value)}`);
    }
    if (!value || value.length !== 3) throw new Error(`vec3 ${name} got ${JSON.stringify(value)}`);
    this.gl.uniform3f(this.location(name), value[0], value[1], value[2]);
    return this;
  }

  float(name, value) {
    this.gl.uniform1f(this.location(name), value);
    return this;
  }

  int(name, value) {
    this.gl.uniform1i(this.location(name), value);
    return this;
  }
}

/** A mesh's GPU home: its vertex arrays and how many vertices to draw. */
export class GpuMesh {
  constructor(gl, buffers) {
    this.gl = gl;
    this.count = buffers.count;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const attributes = [
      { location: 0, data: buffers.positions, size: 3 },
      { location: 1, data: buffers.normals, size: 3 },
      { location: 2, data: buffers.colours, size: 3 },
    ];
    for (const attribute of attributes) {
      if (!attribute.data) continue;
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, attribute.data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(attribute.location);
      gl.vertexAttribPointer(attribute.location, attribute.size, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
  }

  draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
  }
}

/** A plane of vertices for the sea, drawn as a triangle list with its own shader. */
export class GpuPositions {
  constructor(gl, positions, count) {
    this.gl = gl;
    this.count = count;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
  }
}

export function createPrograms(gl) {
  return {
    lit: new Program(gl, LIT_VERT, LIT_FRAG),
    sky: new Program(gl, SKY_VERT, SKY_FRAG),
    water: new Program(gl, WATER_VERT, WATER_FRAG),
  };
}

/** An empty vertex array for the full-screen triangle the sky is drawn with. */
export function createFullscreenTriangle(gl) {
  return gl.createVertexArray();
}

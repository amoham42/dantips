import * as THREE from "three";

export default class DnaHelix extends THREE.InstancedMesh<
  THREE.SphereGeometry,
  THREE.MeshStandardMaterial
> {
  private _count: number;
  private _time: number;
  private _tempMatrix: THREE.Matrix4;
  private _offsets!: Float32Array;
  private _radians!: Float32Array;
  private _radii!: Float32Array;
  private _baseInstanceOffset: Float32Array;
  private _baseRadians: Float32Array;
  private _baseRadii: Float32Array;
  private _delays: Float32Array;
  private _colors: Float32Array;
  private _colorAttr: THREE.InstancedBufferAttribute;
  private _intensity: Float32Array;
  private _intensityDelta: Float32Array;
  private _repulsionCenter: THREE.Vector3;
  private _repulsionRadius: number;

  private _tempPhases: Float32Array;
  private _tempSinPhases: Float32Array;
  private _tempRadians: Float32Array;
  private _velocities: Float32Array;
  private _masses: Float32Array;

  private _springStiffness: number;
  private _damping: number;
  private _repulsionStrength: number;

  constructor() {
    const geometry = new THREE.SphereGeometry(0.36, 16, 16);

    const numHelix = 10000;
    const numLineSpace = 30;
    const numLine = 150;

    const lengthScale = 0.75;
    const halfLength = 115 * lengthScale;
    const totalRotationDeg = 900 * lengthScale;
    const numAmount = numHelix + numLineSpace * numLine;

    // prettier-ignore
    const baInstanceOffset = new THREE.InstancedBufferAttribute(
      new Float32Array(numAmount * 3), 3
    );

    // prettier-ignore
    const baRadians = new THREE.InstancedBufferAttribute(
      new Float32Array(numAmount), 1
    );

    // prettier-ignore
    const baRadiuses = new THREE.InstancedBufferAttribute(
      new Float32Array(numAmount), 1
    );

    // prettier-ignore
    const baDelays = new THREE.InstancedBufferAttribute(
      new Float32Array(numAmount), 1
    );

    // prettier-ignore
    const baColors = new THREE.InstancedBufferAttribute(
      new Float32Array(numAmount * 4), 4
    );

    for (let i = 0; i < numHelix; i++) {
      const random = Math.random() * 0.7;
      const diff = {
        x: (Math.random() * 2 - 1) * random * 4,
        y: (Math.random() * 2 - 1) * random * 4,
        z: (Math.random() * 2 - 1) * random * 4,
      };
      baInstanceOffset.setXYZ(
        i,
        ((i / numHelix) * 2 - 1) * halfLength + diff.x,
        diff.y,
        diff.z
      );
      baRadians.setX(
        i,
        THREE.MathUtils.degToRad((i / numHelix) * totalRotationDeg + (i % 2) * 180)
      );
      baRadiuses.setX(i, 18);
      baDelays.setX(i, THREE.MathUtils.degToRad(Math.random() * 360));
      baColors.setXYZW(i, 0, 0, 0, 1);
    }
    for (let j = 0; j < numLineSpace; j++) {
      const radians = THREE.MathUtils.degToRad((j / numLineSpace) * totalRotationDeg);
      for (let k = 0; k < numLine; k++) {
        const index = j * numLine + k + numHelix;
        const diff = {
          x: (Math.random() * 2 - 1) * 0.01,
          y: (Math.random() * 2 - 1) * 0.01,
          z: (Math.random() * 2 - 1) * 0.01,
        };

        baInstanceOffset.setXYZ(
          index,
          ((j / numLineSpace) * 2 - 1) * halfLength + diff.x,
          diff.y,
          diff.z
        );
        baRadians.setX(index, radians);
        baRadiuses.setX(index, ((k / numLine) * 2 - 1) * 18);
        baDelays.setX(index, THREE.MathUtils.degToRad(Math.random() * 360));
        baColors.setXYZW(index, 0, 0, 0, 1)
      }
    }
    const colorBlue = new THREE.Color(0x66ccff).convertSRGBToLinear();
    const colorRed = new THREE.Color(0xd60486).convertSRGBToLinear();

    for (let i = 0; i < numHelix; i++) {
      if(i % 2 === 0) baColors.setXYZW(i, colorBlue.r, colorBlue.g, colorBlue.b, 0.3 * Math.random());
      else baColors.setXYZW(i, colorRed.r, colorRed.g, colorRed.b, 0.6 * Math.random());
    }

    for (let j = 0; j < numLineSpace; j++) {
      for (let k = 0; k < numLine; k++) {
        const index = j * numLine + k + numHelix;
        const isLeftHalf = k < (numLine / 2);
        const alternate = j % 2 === 0;
        if(isLeftHalf) {
          if(alternate) baColors.setXYZW(index, colorRed.r, colorRed.g, colorRed.b, 0.6 * Math.random()); 
          else baColors.setXYZW(index, colorBlue.r, colorBlue.g, colorBlue.b, 0.3 * Math.random());
        }  
        else {
          if(alternate) baColors.setXYZW(index, colorBlue.r, colorBlue.g, colorBlue.b, 0.3 * Math.random());
          else baColors.setXYZW(index, colorRed.r, colorRed.g, colorRed.b, 0.6 * Math.random());
        }

      }
    }
    geometry.setAttribute('color', baColors);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.35,
      emissive: new THREE.Color(0xff0000),
      emissiveIntensity: 1.0,
      vertexColors: true,
    });

    material.onBeforeCompile = (shader) => {
      console.log(shader.fragmentShader);
      shader.vertexShader = shader.vertexShader.replace(
        'in vec3 color;',
        'in vec4 color;'
      );
      
      // Add the out declaration separately after the existing declarations
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `out float newEmissiveIntensity;
         void main() {`
      );
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <color_vertex>',
        `
        #include <color_vertex>
        vColor *= vec4(color.rgb, 1.0);
        newEmissiveIntensity = color.a;
        `
      );
    
      shader.fragmentShader = shader.fragmentShader.replace(
        'uniform float opacity;',
        `
        uniform float opacity;
        in float newEmissiveIntensity;
        `
      );
 
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `
        vec3 totalEmissiveRadiance = vColor.rgb * newEmissiveIntensity;
        `
      );

    };

    super(geometry, material, numAmount);
    this.name = "DNA Helix (Spheres)";

    this._count = numAmount;
    this._time = 0;
    this._tempMatrix = new THREE.Matrix4();

    this._offsets = new Float32Array(numAmount * 3);
    this._radians = new Float32Array(numAmount);
    this._radii = new Float32Array(numAmount);
    this._colors = new Float32Array(baColors.array)
    this._baseInstanceOffset = new Float32Array(baInstanceOffset.array);
    this._baseRadians = new Float32Array(baRadians.array);
    this._baseRadii = new Float32Array(baRadiuses.array);
    this._delays = new Float32Array(baDelays.array);
 
    this._repulsionCenter = new THREE.Vector3(0, 0, 0);
    this._repulsionRadius = 0;

    this._tempPhases = new Float32Array(numAmount);
    this._tempSinPhases = new Float32Array(numAmount);
    this._tempRadians = new Float32Array(numAmount);

    this._velocities = new Float32Array(numAmount * 3);
    this._masses = new Float32Array(numAmount);
    for (let i = 0; i < numAmount; i++) {
      this._masses[i] = 0.7 + Math.random() * 0.6;
    }

    this._springStiffness = 8.0;
    this._damping = 2.2;
    this._repulsionStrength = 20.0;
    for (let i = 0; i < numAmount; i++) {
      const j = i * 3;
      this._offsets[j] = this._baseInstanceOffset[j];
      this._offsets[j + 1] = this._baseInstanceOffset[j + 1];
      this._offsets[j + 2] = this._baseInstanceOffset[j + 2];
      this._radians[i] = this._baseRadians[i];
      this._radii[i] = this._baseRadii[i];
      this._colors[i] = this._colors[i]
      this._tempMatrix.identity();
      this._tempMatrix.setPosition(
        this._offsets[j],
        this._offsets[j + 1],
        this._offsets[j + 2]
      );
      this.setMatrixAt(i, this._tempMatrix);
    }
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initialize color attribute and intensity buffers after super()
    this._colorAttr = baColors as THREE.InstancedBufferAttribute;
    this._intensity = new Float32Array(numAmount);
    this._intensityDelta = new Float32Array(numAmount);
    for (let i = 0; i < numAmount; i++) {
      const baseIntensity = (baColors.array as Float32Array)[i * 4 + 3] || 1.0;
      this._intensity[i] = baseIntensity;
      this._intensityDelta[i] = (Math.random() * 2 - 1) * 0.6;
    }
  }

  setRepulsionCenter(vec3: THREE.Vector3) {
    this._repulsionCenter.copy(vec3);
  }

  setRepulsionRadius(radius: number) {
    this._repulsionRadius = radius;
  }

  render(time: number) {
 
    this._time += time * 0.4;
    const timePhase = this._time * 4.0;
    const timeRadian = this._time * 0.4;

    const count = this._count;

    const offsets = this._offsets;
    const radians = this._radians;
    const radii = this._radii;
    const colors = this._colors;
    const baseOffsets = this._baseInstanceOffset;
    const baseRadians = this._baseRadians;
    const baseRadii = this._baseRadii;
    const delays = this._delays;
    const tempPhases = this._tempPhases;
    const tempSinPhases = this._tempSinPhases;
    const tempRadians = this._tempRadians;
 
    // Randomly vary emissive intensity for a subset, then update all intensities smoothly
    {
      const countToToggle = Math.max(1, Math.floor(count * 0.002));
      for (let t = 0; t < countToToggle; t++) {
        const idx = (Math.random() * count) | 0;
        const speed = Math.random(); // units per second
        this._intensityDelta[idx] = (Math.random() < 0.5 ? -1 : 1) * speed;
      }

      const intensities = this._intensity;
      const deltas = this._intensityDelta;
      const colorAttr = this._colorAttr;
      const colorArray = colorAttr.array as Float32Array;
      const minIntensity = 0.2;
      const maxIntensity = 1.8;

      for (let i = 0; i < count; i++) {
        let newI = intensities[i] + deltas[i] * time;
        if (newI > maxIntensity) {
          newI = maxIntensity;
          deltas[i] = -Math.abs(deltas[i]);
        } else if (newI < minIntensity) {
          newI = minIntensity;
          deltas[i] = Math.abs(deltas[i]);
        }
        intensities[i] = newI;
        colorArray[i * 4 + 3] = newI; // write back to attribute alpha
      }
      colorAttr.needsUpdate = true;
    }

    for (let i = 0; i < count; i++) {
      tempPhases[i] = timePhase + delays[i];
      tempRadians[i] = baseRadians[i] + timeRadian;
    }

    for (let i = 0; i < count; i++) {
      tempSinPhases[i] = Math.sin(tempPhases[i]) * 0.5;
    }

    const repulseRadius = this._repulsionRadius;
    const hasRepulse = repulseRadius > 0;
    const repulseRadiusSq = repulseRadius * repulseRadius;
    const rcx = this._repulsionCenter.x;
    const rcy = this._repulsionCenter.y;
    const rcz = this._repulsionCenter.z;
    const minDistThreshold = 1e-5;

    const springK = this._springStiffness;
    const damping = this._damping;
    const repulseK = this._repulsionStrength;

    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const sPhase = tempSinPhases[i];
      const dynamicRadius = baseRadii[i] + sPhase;
      const updatedRadian = tempRadians[i];

      const sinR = Math.sin(updatedRadian) * 0.7;
      const cosR = Math.cos(updatedRadian) * 0.7;

      const targetX = baseOffsets[j] + sPhase;
      const targetY = sinR * dynamicRadius + baseOffsets[j + 1];
      const targetZ = cosR * dynamicRadius + baseOffsets[j + 2];

      const px = offsets[j];
      const py = offsets[j + 1];
      const pz = offsets[j + 2];

      let fx = (targetX - px) * springK;
      let fy = (targetY - py) * springK;
      let fz = (targetZ - pz) * springK;

      if (hasRepulse) {
        const dx = px - rcx;
        const dy = py - rcy;
        const dz = pz - rcz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < repulseRadiusSq && distSq > minDistThreshold) {
          const dist = Math.sqrt(distSq);
          const inside = repulseRadius - dist;
          if (inside > 0.0) {
            const scale = (repulseK * inside) / dist;
            fx += dx * scale;
            fy += dy * scale;
            fz += dz * scale;
          }
        } else if (distSq <= minDistThreshold) {

          fy += repulseK * repulseRadius;
        }
      }

      const invMass = 1.0 / this._masses[i];
      const ax = fx * invMass;
      const ay = fy * invMass;
      const az = fz * invMass;

      const vxIndex = j;
      const vyIndex = j + 1;
      const vzIndex = j + 2;
      let vx = this._velocities[vxIndex];
      let vy = this._velocities[vyIndex];
      let vz = this._velocities[vzIndex];

      vx += ax * time;
      vy += ay * time;
      vz += az * time;

      const dampFactor = Math.max(0, 1 - damping * time);
      vx *= dampFactor;
      vy *= dampFactor;
      vz *= dampFactor;

      offsets[j] = px + vx * time;
      offsets[j + 1] = py + vy * time;
      offsets[j + 2] = pz + vz * time;
     
      this._velocities[vxIndex] = vx;
      this._velocities[vyIndex] = vy;
      this._velocities[vzIndex] = vz;
      radians[i] = updatedRadian;
      radii[i] = dynamicRadius;
      colors[i] = this._colors[i];
      this._tempMatrix.identity();
      this._tempMatrix.setPosition(
        offsets[j],
        offsets[j + 1],
        offsets[j + 2]
      );
      this.setMatrixAt(i, this._tempMatrix);
    }

    this.instanceMatrix.needsUpdate = true;
  }

  dispose(): this {
    return this;
  }
}
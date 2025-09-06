"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import DnaHelix from "./DNAHelix";
import { EffectComposer, RenderPass, EffectPass, SelectiveBloomEffect, BlendFunction, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { BackgroundFS, BackgroundVS } from "./shaders/backgroundShader";

type WebGLLoseContextExtension = {
  loseContext: () => void;
  restoreContext?: () => void;
};

export default function CanvasScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const scene = new THREE.Scene();

    scene.background = null;
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    
    camera.position.set(22.0, 34.0, 29.5);
    camera.rotation.set(-0.62, 0.36, -0.4)

    const renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      stencil: false,
      depth: true
    });

    renderer.autoClear = false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    const backgroundShader = new THREE.ShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
        timer: { value: 0 },
        aspectratio: { value: mount.clientWidth / mount.clientHeight },
        colora: { value: [0.9373, 0, 0] },
        colorb: { value: [0.0314, 0, 0.1686] },
        colorc: { value: [0, 0, 0] },
        backgroundcolor: { value: [0, 0, 0] },
        granular: { value: 1.0 },
        mixMin: { value: 0.2 },
        mixMax: { value: 0.63 },
        distanceminA: { value: 0.0 },
        distancemaxA: { value: 1.3 },
        distanceminB: { value: 0.0 },
        distancemaxB: { value: 1.1 },
      },
      vertexShader: BackgroundVS,
      fragmentShader: BackgroundFS,
      depthTest: false,
      depthWrite: false,
    });
    const backgroundGeometry = new THREE.PlaneGeometry(mount.clientWidth, mount.clientHeight);
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundShader);
    scene.add(backgroundMesh);
    
    const renderPass = new RenderPass(scene, camera);

    const selectiveBloom = new SelectiveBloomEffect(scene, camera, {
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      luminanceThreshold: 0.0,
      luminanceSmoothing: 0.1,
      intensity: 1.2,
      levels: 8,
      radius: 0.65,
    });
    selectiveBloom.inverted = false;

    const toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    });
    const toneMappingPass = new EffectPass(camera, toneMappingEffect);
    composer.addPass(renderPass);
    const selectiveBloomPass = new EffectPass(camera, selectiveBloom);
    composer.addPass(selectiveBloomPass);
    composer.addPass(toneMappingPass);
    composer.setSize(mount.clientWidth, mount.clientHeight);

    const helix = new DnaHelix();
    scene.add(helix);

    selectiveBloom.selection.add(helix);

    const interactionSphere = new THREE.Mesh(
      new THREE.SphereGeometry(10, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );

    interactionSphere.visible = false;
    scene.add(interactionSphere);

    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 80), 0); // z = 0 plane
    const planeHit = new THREE.Vector3();

    // Initialize repulsion
    helix.setRepulsionRadius(22);
    helix.setRepulsionCenter(new THREE.Vector3(500, 0, 0));

    const onPointerMove = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
    
      const hit = raycaster.ray.intersectPlane(plane, planeHit);
      if (hit) {
        interactionSphere.position.copy(hit);
        helix.setRepulsionCenter(hit);
      }
    };
    
    window.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setSize(mount.clientWidth, mount.clientHeight);
      backgroundShader.uniforms.resolution.value.set(mount.clientWidth, mount.clientHeight);
      backgroundShader.uniforms.aspectratio.value = mount.clientWidth / mount.clientHeight;
    };
    window.addEventListener("resize", onResize);
    
    const clock = new THREE.Clock();
    let isDisposed = false;
    let rafId = 0;
    const animate = () => {
      if (isDisposed) return;
      rafId = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      helix.render(dt);
      backgroundShader.uniforms.timer.value += dt;
      composer.render();

    };
    animate();

    // Cleanup
    return () => {
      isDisposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove, { capture: true } as EventListenerOptions);

      window.removeEventListener("resize", onResize);
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }

      if (helix.dispose) {
        helix.dispose();
      }

      interactionSphere.geometry.dispose();
      const mat = interactionSphere.material as THREE.Material;
      mat.dispose();

      renderer.dispose();
      const gl = renderer.getContext();
      const loseCtx = gl.getExtension("WEBGL_lose_context") as WebGLLoseContextExtension | null;
      if (loseCtx) loseCtx.loseContext();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}
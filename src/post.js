// ポストエフェクト：環境遮蔽(GTAO)・ブルーム・色調補正・周辺減光・速度ブラー
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from '../vendor/three/addons/postprocessing/GTAOPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeed: { value: 0 },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSpeed, uTime, uVignette, uAspect; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      // 疾走感：画面端ほど放射方向に流れる
      float r = length(c * vec2(uAspect, 1.0));
      float amt = uSpeed * smoothstep(0.18, 0.75, r) * 0.022;
      vec3 col = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        col += texture2D(tDiffuse, vUv - c * amt * t).rgb;
      }
      col /= 8.0;
      // 色調：わずかに暖色の秋の午後、影は青み
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, col * vec3(1.05, 1.0, 0.92), smoothstep(0.1, 1.2, l));
      col = mix(col * vec3(0.94, 0.98, 1.06), col, smoothstep(0.0, 0.25, l));
      col = mix(vec3(l), col, 1.08);
      // 周辺減光
      float v = smoothstep(0.95, 0.25, r);
      col *= mix(1.0 - uVignette, 1.0, v);
      // ごく弱いフィルム粒子
      col += (rand(vUv * 913.0 + uTime) - 0.5) * 0.012 * (0.3 + l);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export const QUALITY = {
  high: { pixelRatio: 2, shadow: 4096, ao: true, bloom: true, msaa: 4 },
  medium: { pixelRatio: 1.5, shadow: 2048, ao: false, bloom: true, msaa: 4 },
  low: { pixelRatio: 1, shadow: 1024, ao: false, bloom: false, msaa: 0 },
};

export function createPost(renderer, scene, camera, quality) {
  const q = QUALITY[quality];
  if (quality === 'low') {
    // スマホ向け：全画面の後処理をすべて省き、そのまま描画する（解像度は main.js が自動調整）
    return { composer: null, pulse() {}, setSize() {}, render() { renderer.render(scene, camera); } };
  }
  const size = renderer.getSize(new THREE.Vector2());
  const pr = Math.min(window.devicePixelRatio, q.pixelRatio);
  renderer.setPixelRatio(pr);
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: q.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (q.ao) {
    ao = new GTAOPass(scene, camera, size.x, size.y);
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = 0.85;
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.5, scale: 1, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    composer.addPass(ao);
  }
  let bloom = null;
  if (q.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.6, 0.92);
    composer.addPass(bloom);
  }
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  return {
    composer, grade, ao, bloom, boost: 0,
    pulse(v) { this.boost = Math.max(this.boost, v); },
    setSize(w, h) {
      composer.setSize(w, h);
      grade.uniforms.uAspect.value = w / h;
    },
    render(dt, speed, time) {
      grade.uniforms.uSpeed.value = speed;
      this.boost *= Math.exp(-dt * 3);
      if (bloom) bloom.strength = 0.22 + this.boost * 1.2;
      grade.uniforms.uVignette.value = 0.32 + this.boost * 0.25;
      grade.uniforms.uTime.value = time % 100;
      composer.render(dt);
    },
  };
}

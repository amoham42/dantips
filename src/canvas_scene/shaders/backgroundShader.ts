const BackgroundVS = `
precision highp float;
precision highp int;
varying vec2 vUv;
varying vec2 vUv2;
uniform float aspectratio;

float when_fgt(float x, float y) {
    return max(sign(x - y), 0.0);
}

vec2 correctRatio(vec2 inUv, float baseratio, float asp) {
    return mix(
    vec2(
    inUv.x, inUv.y * baseratio / asp + .5 * ( 1. - baseratio / asp )
    ), vec2(
    inUv.x * asp / baseratio + .5 * ( 1. - asp / baseratio), inUv.y
    ), when_fgt(baseratio, asp)
    );
}

vec2 screenspacefrompos(vec4 sspPos) {
    vec4 tempssp = sspPos;
    tempssp.xyz /= tempssp.w;
    tempssp.xy = (0.5)+(tempssp.xy)*0.5;
    return tempssp.xy;
}
    
void main() {
    vUv = vec2(0.5)+(position.xy)*0.5;
    vUv = correctRatio(vUv, 1.0, aspectratio );
    gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

const BackgroundFS = `
precision highp float;
precision highp int;

varying vec2 vUv;
uniform float aspectratio;
uniform vec2 resolution;
uniform vec3 colora;
uniform vec3 colorb;
uniform vec3 backgroundcolor;
uniform float timer;
uniform float distanceminA;
uniform float distanceminB;
uniform float distancemaxA;
uniform float distancemaxB;
uniform float granular;
uniform float mixMin;
uniform float mixMax;
uniform vec3 colorc;
vec2 point = vec2(0.2, 0.2);
vec2 point2 = vec2(0.4, 0.9);
highp float random(vec2 co) {
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt = dot(co.xy, vec2(a, b));
    highp float sn = mod(dt, 3.14);
    return fract(sin(sn) * c);
}

highp float noise (in vec2 st) {
    highp vec2 i = floor(st);
    highp vec2 f = fract(st);
    highp float a = random(i);
    highp float b = random(i + vec2(1.0, 0.0));
    highp float c = random(i + vec2(0.0, 1.0));
    highp float d = random(i + vec2(1.0, 1.0));
    highp vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) +
    (c - a)* u.y * (1.0 - u.x) +
    (d - b) * u.x * u.y;
}
highp float fbm (vec2 st) {
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    float yolo = noise(
    vec2(
    cos(timer - 5.55 + st.x), cos(timer - st.y)
    ) - 0.5
    );
    for (int i = 0; i < 2; i++) {
        value += amplitude * noise(st + vec2(yolo));
        st *= 2.;
        amplitude *= .5;
    }
    return value;
}
void main() {
    vec3 color = vec3(0.0);
    float rnd = random(vUv.xy);
    float perturbedFragCoordY = rnd * 0.001 * granular;
    color += fbm(vUv.xy * 2.0 + timer * 0.05) + perturbedFragCoordY;
    float mixx = smoothstep(mixMin, mixMax, color.r + perturbedFragCoordY);
    vec3 finColor = backgroundcolor;
    float distA = smoothstep(distanceminA, distancemaxA, distance(vUv, point)  );
    float distB = smoothstep(distanceminB, distancemaxB, distance(vUv, point2) );
    vec3 colorFirstPoint = mix(colora, colorc, distA);
    vec3 colorSecondPoint = mix(colorb, colorFirstPoint, distB);
    gl_FragColor = vec4(mix(colorSecondPoint, finColor, mixx), 1.0);
    gl_FragColor.rgb += rnd * 0.03;
    gl_FragColor.rgb *= 0.35;
}

`;

export { BackgroundFS, BackgroundVS };
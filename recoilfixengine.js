// 🖱️ Hàm mock gửi input chuột
function sendInputToMouse({ deltaX, deltaY }) {
  console.log(`🎯 Mouse Input → ΔX=${deltaX.toFixed(3)} | ΔY=${deltaY.toFixed(3)}`);
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  subtract(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }

  normalize() {
    const len = this.length();
    if (len === 0) return this;
    return this.multiplyScalar(1 / len);
  }

  distance(v) {
    return Math.sqrt(
      (this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2
    );
  }

  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
}

const EPSILON = 1e-6;
const SENSITIVITY_MULTIPLIER = { x: 0.52, y: 0.49 };

function applyBindpose(position, bindpose) {
  const { x, y, z } = position;
  return new Vector3(
    bindpose.e00 * x + bindpose.e01 * y + bindpose.e02 * z + bindpose.e03,
    bindpose.e10 * x + bindpose.e11 * y + bindpose.e12 * z + bindpose.e13,
    bindpose.e20 * x + bindpose.e21 * y + bindpose.e22 * z + bindpose.e23
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

class RecoilFixEngine {
  constructor() {
    this.prevAngle = new Vector3(0, 0, 0);
    this.currentWeapon = "default";
    this.shotCount = 0;
    this.lastShotTime = 0;
    this.recoilPatternIndex = 0;

    this.recoilMap = {
      default: {
        recoilX: 0.0,
        recoilY: 0.0,
        smooth: 0.85,
        pattern: [1.0],
        recoveryRate: 1.0
      },
      mp40: {
        recoilX: 0.0,
        recoilY: 0.0,
        smooth: 0.78,
        pattern: [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8],
        recoveryRate: 0.88
      },
      ump: {
        recoilX: 0.0,
        recoilY: 0.0,
        smooth: 0.82,
        pattern: [1.0, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7],
        recoveryRate: 0.90
      },
      m1887: {
        recoilX: 0.0,
        recoilY: 0.0,
        smooth: 0.75,
        pattern: [1.0, 1.5, 2.0, 2.5],
        recoveryRate: 0.85
      },
      ak: {
        recoilX: 0.0,
        recoilY: 0.0,
        smooth: 0.72,
        pattern: [1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7],
        recoveryRate: 0.85
      }
    };

    this.predictedPositions = [];
    this.maxPredictionHistory = 5;

    this.adaptiveSmoothing = {
      baseSmooth: 0.8,
      distanceMultiplier: 0.1,
      velocityMultiplier: 0.05
    };
  }

  setWeapon(name) {
    this.currentWeapon = this.recoilMap[name] ? name : "default";
    this.shotCount = 0;
    this.recoilPatternIndex = 0;
  }

  applyKalman(current, previous, smooth, distance = 1.0, velocity = 0.0) {
    const adaptiveSmooth = clamp(
      smooth - (distance * this.adaptiveSmoothing.distanceMultiplier) +
      (velocity * this.adaptiveSmoothing.velocityMultiplier),
      0.3, 0.95
    );
    return new Vector3(
      adaptiveSmooth * current.x + (1 - adaptiveSmooth) * previous.x,
      adaptiveSmooth * current.y + (1 - adaptiveSmooth) * previous.y,
      0
    );
  }

  getRecoilMultiplier() {
    const weapon = this.recoilMap[this.currentWeapon];
    const index = Math.min(this.recoilPatternIndex, weapon.pattern.length - 1);
    return weapon.pattern[index];
  }

  predictPosition(currentPos, previousPositions, deltaTime) {
    if (previousPositions.length < 2) return currentPos;

    const velocity = currentPos.clone().subtract(previousPositions[0]).multiplyScalar(1 / deltaTime);
    const acceleration = velocity.clone().subtract(
      previousPositions[0].clone().subtract(previousPositions[1]).multiplyScalar(1 / deltaTime)
    ).multiplyScalar(1 / deltaTime);

    const predictionTime = 0.05;
    return currentPos.clone()
      .add(velocity.clone().multiplyScalar(predictionTime))
      .add(acceleration.clone().multiplyScalar(0.5 * predictionTime * predictionTime));
  }

  compensateRecoil(yaw, pitch, isFiring, distance = 1.0, velocity = 0.0) {
    const weapon = this.recoilMap[this.currentWeapon];
    const currentTime = Date.now();

    if (currentTime - this.lastShotTime > 500) {
      this.shotCount = 0;
      this.recoilPatternIndex = 0;
    }

    let recoilX = 0;
    let recoilY = 0;

    if (isFiring) {
      const multiplier = this.getRecoilMultiplier();
      recoilX = -weapon.recoilX * multiplier + (Math.random() - 0.5) * weapon.recoilX * 0.1;
      recoilY = -weapon.recoilY * multiplier + (Math.random() - 0.5) * weapon.recoilY * 0.1;

      this.shotCount++;
      this.recoilPatternIndex = Math.min(this.recoilPatternIndex + 1, weapon.pattern.length - 1);
      this.lastShotTime = currentTime;
    } else {
      this.recoilPatternIndex = Math.max(0, this.recoilPatternIndex - 1);
      this.prevAngle.multiplyScalar(weapon.recoveryRate);
    }

    const current = new Vector3(yaw + recoilX, pitch + recoilY, 0);
    const smoothed = this.applyKalman(current, this.prevAngle, weapon.smooth, distance, velocity);
    this.prevAngle = smoothed.clone();
    return smoothed;
  }

  aimToHead(camera, headWorldPos, isFiring = false, previousPositions = []) {
    const cameraPos = new Vector3(camera.position.x, camera.position.y, camera.position.z);
    const predictedPos = this.predictPosition(headWorldPos, previousPositions, 0.016);
    const dir = predictedPos.clone().subtract(cameraPos);
    const distance = dir.length();
    dir.normalize();

    const velocity = previousPositions.length > 0 ?
      headWorldPos.distance(previousPositions[0]) / 0.016 : 0;

    const pitch = -Math.asin(clamp(dir.y, -1, 1));
    const yaw = Math.atan2(dir.x, dir.z);

    const compensated = this.compensateRecoil(yaw, pitch, isFiring, distance, velocity);
    const distanceMultiplier = Math.max(0.3, Math.min(1.0, 1.0 / (distance + 0.1)));
    const sensitivity = {
      x: SENSITIVITY_MULTIPLIER.x * distanceMultiplier,
      y: SENSITIVITY_MULTIPLIER.y * distanceMultiplier
    };

    sendInputToMouse({
      deltaX: compensated.x * sensitivity.x,
      deltaY: compensated.y * sensitivity.y
    });

    console.log(`🔧 AimFix → Yaw: ${compensated.x.toFixed(3)}, Pitch: ${compensated.y.toFixed(3)}, Dist: ${distance.toFixed(2)}, Shots: ${this.shotCount}`);

    return {
      angle: compensated,
      distance,
      shotCount: this.shotCount,
      recoilMultiplier: this.getRecoilMultiplier()
    };
  }
}

// 🔧 Khởi tạo thử
const recoilEngine = new RecoilFixEngine();
recoilEngine.setWeapon("mp40");

const camera = { position: { x: 0, y: 1.7, z: 0 } };

const enemy = {
  head: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 },
  bindpose: {
    e00: -1.3456e-13, e01: 8.88e-14, e02: -1.0, e03: 0.487912,
    e10: -2.84e-6, e11: -1.0, e12: 8.88e-14, e13: -2.84e-14,
    e20: -1.0, e21: 2.84e-6, e22: -1.72e-13, e23: 0.0,
    e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
  }
};

const headWorld = applyBindpose(enemy.head, enemy.bindpose);
const previousPositions = [
  headWorld.clone().add(new Vector3(0.001, 0, 0)),
  headWorld.clone().add(new Vector3(0.002, 0, 0))
];

const result = recoilEngine.aimToHead(camera, headWorld, true, previousPositions);
console.log("📊 Performance metrics:", result);

// 🖱️ Hàm mock gửi input chuột (phải khai báo trước khi dùng)
function sendInputToMouse({ deltaX, deltaY }) {
  console.log(`🎯 Mouse Input → ΔX=${deltaX.toFixed(3)} | ΔY=${deltaY.toFixed(3)}`);
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  add(v) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
  subtract(v) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
  multiplyScalar(s) { return new Vector3(this.x * s, this.y * s, this.z * s); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  length() { return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2); }
  normalize() {
    const len = this.length();
    return len === 0 ? new Vector3(0, 0, 0) : this.multiplyScalar(1 / len);
  }
}

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
    this.recoilMap = {
      default: { recoilX: 0.01, recoilY: 0.01, smooth: 0.85 },
      mp40:    { recoilX: 0.06, recoilY: 0.09, smooth: 0.80 },
      ump:     { recoilX: 0.03, recoilY: 0.05, smooth: 0.83 },
      m1887:   { recoilX: 0.04, recoilY: 0.05, smooth: 0.78 },
      ak:      { recoilX: 0.07, recoilY: 0.11, smooth: 0.75 }
    };
  }

  setWeapon(name) {
    this.currentWeapon = this.recoilMap[name] ? name : "default";
  }

  applyKalman(current, previous, smooth) {
    return new Vector3(
      smooth * current.x + (1 - smooth) * previous.x,
      smooth * current.y + (1 - smooth) * previous.y,
      0
    );
  }

  compensateRecoil(yaw, pitch, isFiring) {
    const weapon = this.recoilMap[this.currentWeapon];
    const recoilX = isFiring ? -weapon.recoilX : 0;
    const recoilY = isFiring ? -weapon.recoilY : 0;

    const current = new Vector3(yaw + recoilX, pitch + recoilY, 0);
    const smoothed = this.applyKalman(current, this.prevAngle, weapon.smooth);

    this.prevAngle = smoothed.clone();
    return smoothed;
  }

  aimToHead(camera, headWorldPos, isFiring = false) {
    const dx = headWorldPos.x - camera.position.x;
    const dy = headWorldPos.y - camera.position.y;
    const dz = headWorldPos.z - camera.position.z;

    const dir = new Vector3(dx, dy, dz).normalize();

    // Tránh lỗi asin với giá trị vượt giới hạn
    const clampedY = clamp(dir.y, -1, 1);
    const pitch = -Math.asin(clampedY);
    const yaw = Math.atan2(dir.x, dir.z);

    const compensated = this.compensateRecoil(yaw, pitch, isFiring);

    sendInputToMouse({
      deltaX: compensated.x * 0.52,
      deltaY: compensated.y * 0.49
    });

    console.log(`🔧 AimFix → Yaw: ${compensated.x.toFixed(3)}, Pitch: ${compensated.y.toFixed(3)}`);
  }
}

// 🔧 Test Setup
const recoilEngine = new RecoilFixEngine();
recoilEngine.setWeapon("mp40");

const camera = {
  position: { x: 0, y: 1.7, z: 0 }
};

const enemy = {
  head: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 },
  bindpose: {
    e00: -1.3456e-13, e01: 8.88e-14, e02: -1.0, e03: 0.487912,
    e10: -2.84e-6,    e11: -1.0,     e12: 8.88e-14, e13: -2.84e-14,
    e20: -1.0,        e21: 2.84e-6,  e22: -1.72e-13, e23: 0.0,
    e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
  }
};

// 👉 Tính vị trí đầu theo bindpose
const headWorld = applyBindpose(enemy.head, enemy.bindpose);

// 🔫 Aim lock + fix recoil
recoilEngine.aimToHead(camera, headWorld, true);

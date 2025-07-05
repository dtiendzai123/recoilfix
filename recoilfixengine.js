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
class RecoilFixEngine {
  constructor() {
    this.prevOffset = new Vector3(0, 0, 0);
    this.kalmanAlpha = 0.75;
    this.currentWeapon = "default";
    this.recoilMap = {
      default: { x: 0.01, y: 0.01 },
      mp40: { x: 0.06, y: 0.09 },
      ump: { x: 0.01, y: 0.01 },
      m1887: { x: 0.01, y: 0.01 }
    };
  }

  applyKalmanFilter(current, previous) {
    return new Vector3(
      this.kalmanAlpha * current.x + (1 - this.kalmanAlpha) * previous.x,
      this.kalmanAlpha * current.y + (1 - this.kalmanAlpha) * previous.y,
      this.kalmanAlpha * current.z + (1 - this.kalmanAlpha) * previous.z
    );
  }

  compensateRecoil(targetVec, isFiring) {
    const recoil = this.recoilMap[this.currentWeapon] || this.recoilMap["default"];
    const recoilVec = isFiring
      ? new Vector3(-recoil.x, -recoil.y, 0)
      : new Vector3(0, 0, 0);

    const corrected = targetVec.add(recoilVec);
    const smoothed = this.applyKalmanFilter(corrected, this.prevOffset);
    this.prevOffset = smoothed.clone();

    return smoothed;
  }

  aimToHead(camera, headWorldPos, isFiring = false) {
    const dx = headWorldPos.x - camera.position.x;
    const dy = headWorldPos.y - camera.position.y;
    const dz = headWorldPos.z - camera.position.z;

    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dir = new Vector3(dx / dist, dy / dist, dz / dist);

    const pitch = -Math.asin(dir.y);
    const yaw = Math.atan2(dir.x, dir.z);

    const compensatedVec = this.compensateRecoil(new Vector3(yaw, pitch, 0), isFiring);

    sendInputToMouse({
      deltaX: compensatedVec.x * 0.52,
      deltaY: compensatedVec.y * 0.49
    });

    console.log(`🔧 FixRecoil: Yaw=${compensatedVec.x.toFixed(3)} Pitch=${compensatedVec.y.toFixed(3)}`);
  }

  setWeapon(weaponName) {
    this.currentWeapon = weaponName || "default";
  }
}
const recoilEngine = new RecoilFixEngine();
recoilEngine.setWeapon("mp40"); // hoặc "ak", "m1887", ...
recoilEngine.setWeapon("m1887");
const camera = {
  position: { x: 0, y: 1.7, z: 0 }
};

const enemy = {
  head: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 },
  bindpose: {
    e00: -1.3456e-13, e01: 8.88e-14, e02: -1.0, e03: 0.487912,
    e10: -2.84e-6, e11: -1.0, e12: 8.88e-14, e13: -2.84e-14,
    e20: -1.0, e21: 2.84e-6, e22: -1.72e-13, e23: 0.0,
    e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
  }
};

// 👉 Áp dụng bindpose
const headWorld = applyBindpose(enemy.head, enemy.bindpose);

// 🔒 Lock vào đầu với no recoil
recoilEngine.aimToHead(camera, headWorld, true);

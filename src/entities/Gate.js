import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Gate {
  constructor(scene, options) {
    this.scene = scene;
    this.type = options.type || 'add'; // 'add', 'multiply', 'subtract', 'divide', 'spread', 'speed', 'power'
    this.value = options.value || 5;
    this.z = options.z || -30;
    this.baseX = options.x || 0;
    this.x = this.baseX;
    this.width = options.width || CONFIG.GATE.WIDTH;
    this.height = options.height || CONFIG.GATE.HEIGHT;

    // 動くゲート機能
    this.isMoving = options.isMoving || false;
    this.moveSpeed = options.moveSpeed || 2.2;
    this.moveRange = options.moveRange || 1.8;
    this.moveTime = Math.random() * Math.PI * 2;

    this.shotsHit = 0;
    this.passed = false;
    this.popScale = 1.0;

    this.group = new THREE.Group();
    this.group.position.set(this.x, this.height / 2, this.z);

    this.buildMesh();
    this.scene.add(this.group);
  }

  getStyle() {
    if (this.type === 'add') {
      return { bg: 'rgba(0, 160, 255, 0.78)', border: '#00e5ff', label: `+${this.value}`, sub: 'GARY' };
    } else if (this.type === 'multiply') {
      return { bg: 'rgba(255, 179, 0, 0.78)', border: '#ffd700', label: `×${this.value}`, sub: 'GARY' };
    } else if (this.type === 'subtract') {
      return { bg: 'rgba(230, 30, 60, 0.78)', border: '#ff1744', label: `-${this.value}`, sub: 'GARY' };
    } else if (this.type === 'divide') {
      return { bg: 'rgba(180, 20, 40, 0.78)', border: '#ff5252', label: `÷${this.value}`, sub: 'GARY' };
    } else if (this.type === 'spread') {
      return { bg: 'rgba(255, 64, 129, 0.82)', border: '#ff4081', label: '3WAY', sub: 'SPREAD SHOT' };
    } else if (this.type === 'speed') {
      return { bg: 'rgba(156, 39, 176, 0.82)', border: '#e040fb', label: 'RAPID', sub: 'FIRE SPEED' };
    } else if (this.type === 'power') {
      return { bg: 'rgba(255, 112, 67, 0.82)', border: '#ff5722', label: 'MEGA', sub: 'LASER BEAM' };
    } else {
      return { bg: 'rgba(0, 160, 255, 0.78)', border: '#00e5ff', label: `+${this.value}`, sub: 'GARY' };
    }
  }

  drawTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const style = this.getStyle();

    // 背景グラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, style.bg);
    grad.addColorStop(1, 'rgba(10, 15, 32, 0.9)');
    ctx.fillStyle = grad;
    ctx.roundRect(14, 14, 484, 484, 36);
    ctx.fill();

    // 枠線
    ctx.lineWidth = 14;
    ctx.strokeStyle = style.border;
    ctx.roundRect(14, 14, 484, 484, 36);
    ctx.stroke();

    // 動くゲートの場合の左右矢印ガイド
    if (this.isMoving) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◀ MOVE ▶', 256, 80);
    }

    // 数値/バフテキスト
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 110px "Impact", "Arial Black", sans-serif';
    ctx.shadowColor = style.border;
    ctx.shadowBlur = 20;
    ctx.fillText(style.label, 256, 230);

    // サブテキスト
    ctx.font = 'bold 42px sans-serif';
    ctx.shadowBlur = 10;
    ctx.fillText(style.sub, 256, 340);

    // ヒット進捗バー（弾を当てると育つ）
    if (this.type === 'add' || this.type === 'multiply' || this.type === 'subtract') {
      const prog = (this.shotsHit % CONFIG.GATE.SHOTS_TO_UPGRADE) / CONFIG.GATE.SHOTS_TO_UPGRADE;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(50, 420, 412, 18);
      ctx.fillStyle = style.border;
      ctx.fillRect(50, 420, 412 * prog, 18);
    }

    return new THREE.CanvasTexture(canvas);
  }

  buildMesh() {
    // 枠フレーム
    const frameGeo = new THREE.BoxGeometry(this.width, this.height, 0.22);
    const style = this.getStyle();
    const frameMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(style.border),
      emissive: new THREE.Color(style.border),
      emissiveIntensity: 0.7,
      roughness: 0.2
    });
    this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.group.add(this.frameMesh);

    // 画面パネル（キャンバステクスチャ）
    this.panelTexture = this.drawTexture();
    const panelGeo = new THREE.PlaneGeometry(this.width * 0.94, this.height * 0.94);
    const panelMat = new THREE.MeshBasicMaterial({
      map: this.panelTexture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide
    });
    this.panelMesh = new THREE.Mesh(panelGeo, panelMat);
    this.panelMesh.position.z = 0.12;
    this.group.add(this.panelMesh);
  }

  updateVisuals() {
    if (this.panelTexture) {
      this.panelTexture.dispose();
    }
    this.panelTexture = this.drawTexture();
    this.panelMesh.material.map = this.panelTexture;
    this.panelMesh.material.needsUpdate = true;
  }

  onBulletHit() {
    if (this.passed) return;
    this.shotsHit++;
    this.popScale = 1.15; // 弾が当たるとボヨンと膨らむ

    if (this.shotsHit % CONFIG.GATE.SHOTS_TO_UPGRADE === 0) {
      if (this.type === 'add') {
        this.value += 2;
      } else if (this.type === 'multiply' && this.value < 6) {
        this.value += 1;
      } else if (this.type === 'subtract' && this.value > 1) {
        this.value -= 1; // 減算ゲートを撃つと減算ペナルティが減る！
      }
    }
    this.updateVisuals();
  }

  update(delta) {
    // 動くゲートの左右スライド移動
    if (this.isMoving && !this.passed) {
      this.moveTime += delta * this.moveSpeed;
      this.x = this.baseX + Math.sin(this.moveTime) * this.moveRange;
      this.group.position.x = this.x;
    }

    // ポップスケールの減衰
    if (this.popScale > 1.0) {
      this.popScale += (1.0 - this.popScale) * Math.min(1.0, delta * 12.0);
      this.group.scale.set(this.popScale, this.popScale, 1.0);
    }
  }

  applyEffect(garyHorde, mojiSan, app) {
    if (this.passed) return false;
    this.passed = true;

    // 通過アニメーション（半透明化）
    this.panelMesh.material.opacity = 0.25;

    if (this.type === 'add') {
      garyHorde.addCount(this.value);
      return true;
    } else if (this.type === 'multiply') {
      garyHorde.multiplyCount(this.value);
      return true;
    } else if (this.type === 'subtract') {
      garyHorde.addCount(-this.value);
      return false;
    } else if (this.type === 'divide') {
      garyHorde.multiplyCount(1 / this.value);
      return false;
    } else if (this.type === 'spread') {
      // 3WAY拡散ショット解放
      if (app) app.hasSpreadShot = true;
      return true;
    } else if (this.type === 'speed') {
      // 射撃レート大幅アップ
      CONFIG.MOJI.FIRE_INTERVAL = Math.max(0.08, CONFIG.MOJI.FIRE_INTERVAL * 0.75);
      CONFIG.GARY.FIRE_INTERVAL = Math.max(0.12, CONFIG.GARY.FIRE_INTERVAL * 0.75);
      return true;
    } else if (this.type === 'power') {
      // メガビーム解放（威力倍増・巨大弾）
      if (app) app.hasMegaBeam = true;
      return true;
    }
    return true;
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.panelTexture) this.panelTexture.dispose();
  }
}

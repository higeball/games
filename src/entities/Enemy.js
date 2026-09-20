import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Enemy {
  constructor(scene, options) {
    this.scene = scene;
    this.type = options.type || 'bug'; // 'bug', 'drone', 'tank', 'barrel', 'block'
    this.x = options.x || 0;
    this.z = options.z || -60;
    this.maxHp = options.hp || 30;
    this.hp = this.maxHp;
    this.speed = options.speed || (this.type === 'drone' ? 4.5 : (this.type === 'tank' ? 1.5 : (this.type === 'barrel' || this.type === 'block' ? 0 : 2.8)));

    this.alive = true;
    this.group = new THREE.Group();
    this.group.position.set(this.x, (this.type === 'drone' ? 1.8 : 0.8), this.z);

    this.buildMesh();
    this.buildHpBar();
    this.scene.add(this.group);
  }

  buildMesh() {
    if (this.type === 'barrel') {
      // 爆発ドラム缶（鮮やかな赤＋警告ストライプ）
      const geo = new THREE.CylinderGeometry(0.65, 0.65, 1.5, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd50000,
        emissive: 0xb71c1c,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.5
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.castShadow = true;

      // 警告イエローバンド
      const bandGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.3, 16);
      const bandMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
      const band = new THREE.Mesh(bandGeo, bandMat);
      this.mesh.add(band);

      this.group.add(this.mesh);
    } else if (this.type === 'block') {
      // カウントダウン障害物ブロック（数字キューブ）
      const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x37474f,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x263238,
        emissiveIntensity: 0.4
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.castShadow = true;
      this.group.add(this.mesh);
    } else if (this.type === 'drone') {
      // 空中ドローン（シアン色に発光、ローター回転）
      this.mesh = new THREE.Group();
      const bodyGeo = new THREE.OctahedronGeometry(0.55);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x00b0ff,
        emissive: 0x0091ea,
        emissiveIntensity: 0.6,
        roughness: 0.2
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      this.mesh.add(body);

      // プロペラ・リング
      const ringGeo = new THREE.TorusGeometry(0.75, 0.06, 6, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      this.rotor = new THREE.Mesh(ringGeo, ringMat);
      this.rotor.rotation.x = Math.PI / 2;
      this.mesh.add(this.rotor);

      this.group.add(this.mesh);
    } else if (this.type === 'tank') {
      // 重装甲大型クリーチャー（ダークレッド、角と鎧）
      this.mesh = new THREE.Group();
      const bodyGeo = new THREE.DodecahedronGeometry(1.1);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x880e4f,
        emissive: 0xad1457,
        emissiveIntensity: 0.5,
        roughness: 0.3
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      this.mesh.add(body);

      // 巨大ツノ
      const hornGeo = new THREE.ConeGeometry(0.25, 0.9, 6);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd600 });
      const h1 = new THREE.Mesh(hornGeo, hornMat);
      h1.position.set(-0.5, 0.8, 0.5);
      h1.rotation.x = -0.4;
      const h2 = new THREE.Mesh(hornGeo, hornMat);
      h2.position.set(0.5, 0.8, 0.5);
      h2.rotation.x = -0.4;
      this.mesh.add(h1);
      this.mesh.add(h2);

      this.group.add(this.mesh);
    } else {
      // スパイクバグ（紫色の標準モンスター）
      this.mesh = new THREE.Group();
      const bodyGeo = new THREE.DodecahedronGeometry(0.65);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x8e24aa,
        emissive: 0x4a148c,
        emissiveIntensity: 0.4,
        roughness: 0.3
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      this.mesh.add(body);

      const spikeGeo = new THREE.ConeGeometry(0.18, 0.5, 5);
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0xff1744 });
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.5, 0.2, Math.sin(angle) * 0.5);
        spike.rotation.z = -Math.PI / 2 + angle;
        this.mesh.add(spike);
      }
      this.group.add(this.mesh);
    }
  }

  buildHpBar() {
    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = 128;
    this.hpCanvas.height = 36;
    this.hpCtx = this.hpCanvas.getContext('2d');
    this.hpTexture = new THREE.CanvasTexture(this.hpCanvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.hpTexture });
    this.hpSprite = new THREE.Sprite(spriteMat);
    const yOffset = (this.type === 'tank' ? 1.8 : (this.type === 'drone' ? 1.0 : (this.type === 'block' ? 1.2 : 1.1)));
    this.hpSprite.position.set(0, yOffset, 0);
    this.hpSprite.scale.set(1.5, 0.4, 1);
    this.group.add(this.hpSprite);

    this.updateHpBar();
  }

  updateHpBar() {
    const ctx = this.hpCtx;
    ctx.clearRect(0, 0, 128, 36);

    // 外枠と背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.roundRect(2, 2, 124, 32, 8);
    ctx.fill();

    // HP量バー
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = (this.type === 'barrel' ? '#ff9100' : (ratio > 0.4 ? '#ff1744' : '#d50000'));
    ctx.roundRect(4, 4, 120 * ratio, 28, 6);
    ctx.fill();

    // 数値テキスト（トップロード定番のHP数値表示！）
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.hp}`, 64, 18);

    this.hpTexture.needsUpdate = true;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.updateHpBar();

    // 被弾フラッシュ
    if (this.mesh) {
      this.mesh.position.y += 0.06;
      setTimeout(() => { if (this.mesh) this.mesh.position.y -= 0.06; }, 40);
    }

    if (this.hp <= 0) {
      this.alive = false;
      return true; // 撃破
    }
    return false;
  }

  update(delta) {
    if (!this.alive) return;

    // 手前（+Z方向、プレイヤーへ向かって進行）
    this.group.position.z += this.speed * delta;

    if (this.type === 'drone') {
      if (this.rotor) this.rotor.rotation.z += delta * 15.0;
      this.group.position.y = 1.8 + Math.sin(this.group.position.z * 0.2) * 0.3;
    } else if (this.type !== 'barrel' && this.type !== 'block' && this.mesh) {
      this.mesh.rotation.y += delta * 2.5;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.hpTexture) this.hpTexture.dispose();
  }
}

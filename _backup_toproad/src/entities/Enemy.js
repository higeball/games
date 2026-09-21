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
    this.rescueCount = options.rescueCount || 6;
    this.speed = options.speed || (this.type === 'drone' ? 3.5 : (this.type === 'tank' ? 1.2 : (this.type === 'shielded' ? 1.0 : (this.type === 'barrel' || this.type === 'block' || this.type === 'cage' || this.type === 'laser_fence' || this.type === 'turret' ? 0 : 2.2))));

    // レーザーフェンス周期
    this.laserTimer = options.laserOffset || 0;
    this.isLaserActive = false;

    // 砲撃タワー周期
    this.turretTimer = 0;

    this.alive = true;
    this.group = new THREE.Group();
    const yPos = (this.type === 'drone' ? 1.8 : (this.type === 'turret' ? 1.4 : (this.type === 'laser_fence' ? 0.8 : 0.8)));
    this.group.position.set(this.x, yPos, this.z);

    this.buildMesh();
    this.buildHpBar();
    this.scene.add(this.group);
  }

  buildMesh() {
    if (this.type === 'cage') {
      // ゲイリー救助カプセル（緑色の光る牢屋＋中に囚われたミニゲイリー）
      this.mesh = new THREE.Group();
      const cageGeo = new THREE.BoxGeometry(1.6, 1.8, 1.6);
      const cageMat = new THREE.MeshStandardMaterial({
        color: 0x37474f,
        roughness: 0.3,
        metalness: 0.8,
        wireframe: true
      });
      const cage = new THREE.Mesh(cageGeo, cageMat);
      this.mesh.add(cage);

      // 緑のエネルギー格子バー
      for (let i = -0.6; i <= 0.6; i += 0.4) {
        const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.7, 8);
        const barMat = new THREE.MeshBasicMaterial({ color: 0x64ff24 });
        const b1 = new THREE.Mesh(barGeo, barMat);
        b1.position.set(i, 0, 0.78);
        const b2 = new THREE.Mesh(barGeo, barMat);
        b2.position.set(i, 0, -0.78);
        this.mesh.add(b1, b2);
      }

      // 中の囚われゲイリー（ぷにぷに跳ねる）
      const miniGaryGeo = new THREE.SphereGeometry(0.45, 12, 12);
      miniGaryGeo.scale(1.2, 0.9, 1.1);
      const miniGaryMat = new THREE.MeshStandardMaterial({
        color: 0x64ff24,
        emissive: 0x3cd000,
        emissiveIntensity: 0.8
      });
      this.captiveGary = new THREE.Mesh(miniGaryGeo, miniGaryMat);
      this.captiveGary.position.y = -0.2;
      this.mesh.add(this.captiveGary);

      this.group.add(this.mesh);
    } else if (this.type === 'shielded') {
      // 前方シールド装甲兵（前面の巨大防盾が正面弾を完全防御！）
      this.mesh = new THREE.Group();
      const bodyGeo = new THREE.DodecahedronGeometry(0.85);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x455a64,
        roughness: 0.4,
        metalness: 0.7
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      this.mesh.add(body);

      // 巨大エナジー防盾（正面+Z方向）
      const shieldGeo = new THREE.BoxGeometry(1.6, 1.6, 0.18);
      const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00b0ff,
        emissiveIntensity: 0.75,
        roughness: 0.1,
        metalness: 0.9
      });
      this.frontShield = new THREE.Mesh(shieldGeo, shieldMat);
      this.frontShield.position.set(0, 0, 0.75);
      this.mesh.add(this.frontShield);

      this.group.add(this.mesh);
    } else if (this.type === 'laser_fence') {
      // 電磁レーザー柵（2本のパイロン間に危険なビームが点滅）
      this.mesh = new THREE.Group();
      const pylonGeo = new THREE.CylinderGeometry(0.2, 0.25, 1.8, 12);
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.8 });
      const p1 = new THREE.Mesh(pylonGeo, pylonMat);
      p1.position.set(-1.8, 0, 0);
      const p2 = new THREE.Mesh(pylonGeo, pylonMat);
      p2.position.set(1.8, 0, 0);
      this.mesh.add(p1, p2);

      // レーザービーム
      const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.6, 12);
      this.beamMat = new THREE.MeshBasicMaterial({
        color: 0xff1744,
        transparent: true,
        opacity: 0.2
      });
      this.beamMesh = new THREE.Mesh(beamGeo, this.beamMat);
      this.beamMesh.rotation.z = Math.PI / 2;
      this.beamMesh.position.y = 0.4;
      this.mesh.add(this.beamMesh);

      this.group.add(this.mesh);
    } else if (this.type === 'turret') {
      // 砲撃タワー（一定周期で弾を発射する防衛砲台）
      this.mesh = new THREE.Group();
      const baseGeo = new THREE.CylinderGeometry(0.7, 0.9, 1.2, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.8 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      this.mesh.add(base);

      // 砲身
      const barrelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8);
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0xff5722, metalness: 0.9 });
      this.cannonBarrel = new THREE.Mesh(barrelGeo, barrelMat);
      this.cannonBarrel.rotation.x = Math.PI / 2;
      this.cannonBarrel.position.set(0, 0.5, 0.45);
      this.mesh.add(this.cannonBarrel);

      this.group.add(this.mesh);
    } else if (this.type === 'barrel') {
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
    if (this.type === 'laser_fence') return; // レーザー柵は障害物なのでHPバー不要

    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = 128;
    this.hpCanvas.height = 36;
    this.hpCtx = this.hpCanvas.getContext('2d');
    this.hpTexture = new THREE.CanvasTexture(this.hpCanvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.hpTexture });
    this.hpSprite = new THREE.Sprite(spriteMat);
    const yOffset = (this.type === 'tank' ? 1.8 : (this.type === 'shielded' ? 1.5 : (this.type === 'turret' ? 1.7 : (this.type === 'drone' ? 1.0 : (this.type === 'block' ? 1.2 : (this.type === 'cage' ? 1.3 : 1.1))))));
    this.hpSprite.position.set(0, yOffset, 0);
    this.hpSprite.scale.set(1.5, 0.4, 1);
    this.group.add(this.hpSprite);

    this.updateHpBar();
  }

  updateHpBar() {
    if (!this.hpCtx) return;
    const ctx = this.hpCtx;
    ctx.clearRect(0, 0, 128, 36);

    // 外枠と背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.roundRect(2, 2, 124, 32, 8);
    ctx.fill();

    // HP量バー
    const ratio = Math.max(0, this.hp / this.maxHp);
    if (this.type === 'cage') {
      ctx.fillStyle = '#64ff24';
    } else if (this.type === 'shielded') {
      ctx.fillStyle = '#00e5ff';
    } else if (this.type === 'turret') {
      ctx.fillStyle = '#ff9100';
    } else if (this.type === 'barrel') {
      ctx.fillStyle = '#ff9100';
    } else {
      ctx.fillStyle = (ratio > 0.4 ? '#ff1744' : '#d50000');
    }
    ctx.roundRect(4, 4, 120 * ratio, 28, 6);
    ctx.fill();

    // 数値テキスト（トップロード定番のHP数値表示！）
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (this.type === 'cage' ? `救助: ${this.hp}` : (this.type === 'shielded' ? `装甲: ${this.hp}` : `${this.hp}`));
    ctx.fillText(label, 64, 18);

    this.hpTexture.needsUpdate = true;
  }

  takeDamage(amount, bullet = null) {
    if (!this.alive) return false;
    if (this.type === 'laser_fence') return false; // レーザー柵は射撃で破壊不可

    // シールド装甲兵の正面弾防御ギミック！
    if (this.type === 'shielded' && bullet && !bullet.isMega) {
      // 弾が正面側から防盾（前面+Z側、横幅1.6m）に当たった場合のみ防御！
      const dz = bullet.pos.z - this.group.position.z;
      const dx = Math.abs(bullet.pos.x - this.group.position.x);
      if (dz >= -0.25 && dx < 0.95) {
        if (this.frontShield) {
          this.frontShield.scale.set(1.2, 1.2, 1.2);
          setTimeout(() => { if (this.frontShield) this.frontShield.scale.set(1, 1, 1); }, 60);
        }
        return 'deflected'; // 正面のシールドで弾かれた！
      }
    }

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

  update(delta, onTurretAttack = null) {
    if (!this.alive) return;

    // 手前（+Z方向、プレイヤーへ向かって進行）
    this.group.position.z += this.speed * delta;

    if (this.type === 'cage') {
      if (this.captiveGary) {
        this.captiveGary.position.y = -0.2 + Math.abs(Math.sin(Date.now() * 0.007)) * 0.25;
      }
    } else if (this.type === 'laser_fence') {
      // レーザーフェンスのオン/オフ周期
      this.laserTimer += delta;
      const cycle = this.laserTimer % 2.6;
      if (cycle > 1.3) {
        // 危険アクティブ状態
        this.isLaserActive = true;
        if (this.beamMat) this.beamMat.opacity = 0.95;
        if (this.beamMesh) this.beamMesh.scale.set(1.6, 1, 1.6);
      } else {
        // 予告点滅状態
        this.isLaserActive = false;
        if (this.beamMat) this.beamMat.opacity = (Math.sin(this.laserTimer * 14) > 0 ? 0.35 : 0.08);
        if (this.beamMesh) this.beamMesh.scale.set(0.6, 1, 0.6);
      }
    } else if (this.type === 'turret') {
      // 砲撃タワーの射撃
      this.turretTimer += delta;
      if (this.turretTimer >= 2.4 && onTurretAttack) {
        this.turretTimer = 0;
        const shotPos = this.group.position.clone();
        shotPos.y = 1.0;
        shotPos.z += 0.8;
        onTurretAttack(shotPos);
      }
    } else if (this.type === 'drone') {
      if (this.rotor) this.rotor.rotation.z += delta * 15.0;
      this.group.position.y = 1.8 + Math.sin(this.group.position.z * 0.2) * 0.3;
    } else if (this.type !== 'barrel' && this.type !== 'block' && this.type !== 'shielded' && this.mesh) {
      this.mesh.rotation.y += delta * 2.5;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.hpTexture) this.hpTexture.dispose();
  }
}

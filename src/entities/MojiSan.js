import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class MojiSan {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.position = new THREE.Vector3(0, 0, 0);
    this.hp = CONFIG.MOJI.INIT_HP;
    this.maxHp = CONFIG.MOJI.INIT_HP;
    this.fireTimer = 0;
    this.runCycle = 0;

    this.buildModel();
    this.scene.add(this.group);
  }

  buildModel() {
    // マテリアル定義
    const shirtMat = new THREE.MeshStandardMaterial({
      color: CONFIG.MOJI.COLOR_SHIRT,
      roughness: 0.5
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: CONFIG.MOJI.COLOR_PANTS,
      roughness: 0.6
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: CONFIG.MOJI.COLOR_SKIN,
      roughness: 0.65
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: CONFIG.MOJI.COLOR_HAIR,
      roughness: 0.8
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.4
    });
    const cardMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });
    const strapMat = new THREE.MeshBasicMaterial({
      color: 0x1976d2
    });
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x37474f,
      metalness: 0.8,
      roughness: 0.2
    });

    // 1. 体のルート
    this.root = new THREE.Group();
    this.group.add(this.root);

    // 2. 胴体（水色シャツ・がっしり体型）
    const torsoGeo = new THREE.BoxGeometry(0.85, 0.95, 0.55);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 1.35;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // ベルト
    const beltGeo = new THREE.BoxGeometry(0.87, 0.12, 0.57);
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = -0.42;
    this.torso.add(belt);

    // 社員証カード（胸から下げる）
    const strapGeo = new THREE.TorusGeometry(0.28, 0.02, 6, 16, Math.PI);
    const strap = new THREE.Mesh(strapGeo, strapMat);
    strap.rotation.x = Math.PI / 2 + 0.2;
    strap.position.set(0, 0.42, 0.22);
    this.torso.add(strap);

    const cardGeo = new THREE.BoxGeometry(0.22, 0.16, 0.02);
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.position.set(0, 0.05, 0.3);
    this.torso.add(card);

    // 3. 頭部
    this.head = new THREE.Group();
    this.head.position.y = 2.05;
    this.root.add(this.head);

    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.5);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // 髪（短髪）
    const hairGeo = new THREE.BoxGeometry(0.58, 0.25, 0.54);
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.y = 0.2;
    hairMesh.castShadow = true;
    this.head.add(hairMesh);

    // 4. 左腕
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.55, 1.7, 0);
    const armGeo = new THREE.BoxGeometry(0.25, 0.75, 0.25);
    const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
    leftArmMesh.position.y = -0.3;
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);
    this.root.add(this.leftArm);

    // 5. 右腕（銃を構える）
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.55, 1.7, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
    rightArmMesh.position.y = -0.3;
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);

    // ブラスター銃
    const gunGeo = new THREE.BoxGeometry(0.18, 0.25, 0.65);
    const gunMesh = new THREE.Mesh(gunGeo, gunMat);
    gunMesh.position.set(0, -0.6, -0.25);
    gunMesh.castShadow = true;
    this.rightArm.add(gunMesh);

    // 銃口マズルライト
    this.muzzleFlash = new THREE.PointLight(0x00e5ff, 0, 3);
    this.muzzleFlash.position.set(0, -0.6, -0.6);
    this.rightArm.add(this.muzzleFlash);

    this.root.add(this.rightArm);

    // 6. 左脚
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.25, 0.9, 0);
    const legGeo = new THREE.BoxGeometry(0.3, 0.85, 0.32);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.position.y = -0.4;
    leftLegMesh.castShadow = true;
    this.leftLeg.add(leftLegMesh);

    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.44), shoeMat);
    leftShoe.position.set(0, -0.85, -0.06);
    leftShoe.castShadow = true;
    this.leftLeg.add(leftShoe);
    this.root.add(this.leftLeg);

    // 7. 右脚
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.25, 0.9, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLegMesh.position.y = -0.4;
    rightLegMesh.castShadow = true;
    this.rightLeg.add(rightLegMesh);

    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.44), shoeMat);
    rightShoe.position.set(0, -0.85, -0.06);
    rightShoe.castShadow = true;
    this.rightLeg.add(rightShoe);
    this.root.add(this.rightLeg);
  }

  update(delta, currentX, currentZ, isRunning) {
    this.position.set(currentX, 0, currentZ);
    this.group.position.copy(this.position);

    if (isRunning) {
      this.runCycle += delta * 12.0;

      // 脚のスイング
      const legSwing = Math.sin(this.runCycle) * 0.7;
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;

      // 腕のスイング（右腕は前方固定で銃を狙う）
      this.leftArm.rotation.x = -legSwing * 0.8;
      this.rightArm.rotation.x = -Math.PI / 2.3 + Math.sin(this.runCycle * 2) * 0.05;

      // 上体のボビング（上下の跳ね）
      this.root.position.y = Math.abs(Math.sin(this.runCycle)) * 0.12;
      this.torso.rotation.y = Math.sin(this.runCycle) * 0.08;
    } else {
      // アイドル待機
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.root.position.y = 0;
    }

    // マズルフラッシュの減衰
    if (this.muzzleFlash.intensity > 0) {
      this.muzzleFlash.intensity -= delta * 15;
      if (this.muzzleFlash.intensity < 0) this.muzzleFlash.intensity = 0;
    }
  }

  triggerShoot() {
    this.muzzleFlash.intensity = 3.5;
  }

  getGunWorldPos() {
    const pos = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(pos);
    return pos;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  reset() {
    this.hp = this.maxHp;
    this.position.set(0, 0, 0);
    this.group.position.copy(this.position);
    this.runCycle = 0;
  }
}

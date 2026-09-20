import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class GaryHorde {
  constructor(scene) {
    this.scene = scene;
    this.count = CONFIG.GARY.INITIAL_COUNT;
    this.maxCount = CONFIG.GARY.MAX_COUNT;

    this.positions = [];     // 各ゲイリーの現在位置 (Vector3)
    this.targetOffsets = []; // もじさんからの相対配置目標 (Vector3)
    this.phaseOffsets = [];  // バウンス用の位相差

    this.fireTimer = 0;
    this.bounceTime = 0;
    this.speechTimer = 0;

    this.dummy = new THREE.Object3D();
    this.initSpeechBubble();
    this.initInstancedMesh();
    this.rebuildFormation();
  }

  createGaryTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 下地：鮮やかなぷるぷるライムグリーン
    ctx.fillStyle = '#64ff24';
    ctx.fillRect(0, 0, 512, 512);

    // 頭頂部のツヤハイライト（光沢感）
    const shineGrad = ctx.createRadialGradient(256, 120, 20, 256, 120, 180);
    shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    ctx.arc(256, 120, 180, 0, Math.PI * 2);
    ctx.fill();

    // 大きなつぶらな黒目（左右）
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(175, 250, 42, 0, Math.PI * 2);
    ctx.arc(337, 250, 42, 0, Math.PI * 2);
    ctx.fill();

    // 目のメインハイライト（白丸）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(162, 235, 18, 0, Math.PI * 2);
    ctx.arc(324, 235, 18, 0, Math.PI * 2);
    ctx.fill();

    // 目のサブハイライト（右下に小さな白丸）
    ctx.beginPath();
    ctx.arc(186, 265, 8, 0, Math.PI * 2);
    ctx.arc(348, 265, 8, 0, Math.PI * 2);
    ctx.fill();

    // 笑顔のお口（にっこりオープンマウス）
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.arc(256, 305, 36, 0, Math.PI, false);
    ctx.fill();

    // お口の中のピンクの舌
    ctx.fillStyle = '#ff4081';
    ctx.beginPath();
    ctx.arc(256, 325, 20, 0, Math.PI, false);
    ctx.fill();

    // ぷにぷにピンクのほっぺ（チーク）
    ctx.fillStyle = 'rgba(255, 64, 129, 0.65)';
    ctx.beginPath();
    ctx.arc(120, 300, 32, 0, Math.PI * 2);
    ctx.arc(392, 300, 32, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  initSpeechBubble() {
    // 相棒ゲイリーの頭上に浮かぶセリフ吹き出しスプライト
    this.bubbleCanvas = document.createElement('canvas');
    this.bubbleCanvas.width = 256;
    this.bubbleCanvas.height = 128;
    this.bubbleCtx = this.bubbleCanvas.getContext('2d');
    this.bubbleTexture = new THREE.CanvasTexture(this.bubbleCanvas);

    const spriteMat = new THREE.SpriteMaterial({
      map: this.bubbleTexture,
      transparent: true,
      opacity: 0
    });
    this.speechSprite = new THREE.Sprite(spriteMat);
    this.speechSprite.scale.set(2.4, 1.2, 1);
    this.speechSprite.position.set(0, 2.2, 0);
    this.scene.add(this.speechSprite);

    this.speechLines = [
      "もじさーん！",
      "ゲイリーにおまかせ！",
      "もっと増えるよ！",
      "ぽよぽよ〜！",
      "突撃ーー！",
      "ゲート撃って！"
    ];
  }

  showSpeech(text) {
    const ctx = this.bubbleCtx;
    ctx.clearRect(0, 0, 256, 128);

    // 吹き出し背景（黄色〜白）
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#76ff03';
    ctx.lineWidth = 6;
    ctx.roundRect(10, 10, 236, 80, 24);
    ctx.fill();
    ctx.stroke();

    // 吹き出しのしっぽ
    ctx.beginPath();
    ctx.moveTo(110, 90);
    ctx.lineTo(128, 118);
    ctx.lineTo(146, 90);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    // テキスト
    ctx.fillStyle = '#003300';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 50);

    this.bubbleTexture.needsUpdate = true;
    this.speechSprite.material.opacity = 1.0;
    this.speechTimer = 2.2; // 表示秒数
  }

  initInstancedMesh() {
    // スライムの本体ジオメトリ（下は広く、山型に盛り上がるスライム形状）
    const bodyGeo = new THREE.SphereGeometry(CONFIG.GARY.BASE_RADIUS, 20, 18);
    // コンセプト画像通りのぷにっとしたスライム体型（横に広く、縦は扁平）
    bodyGeo.scale(1.25, 0.85, 1.15);

    const faceTexture = this.createGaryTexture();
    const material = new THREE.MeshStandardMaterial({
      map: faceTexture,
      color: CONFIG.GARY.COLOR_BODY,
      roughness: 0.15,
      metalness: 0.1,
      emissive: CONFIG.GARY.COLOR_EMISSIVE,
      emissiveIntensity: 0.55, // 暗いステージでもパッと目を引くネオングロー！
      transparent: true,
      opacity: 0.98
    });

    this.mesh = new THREE.InstancedMesh(bodyGeo, material, this.maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    // 各インスタンスの位置・位相初期化
    for (let i = 0; i < this.maxCount; i++) {
      this.positions.push(new THREE.Vector3(0, 0, 0));
      this.targetOffsets.push(new THREE.Vector3(0, 0, 0));
      this.phaseOffsets.push(Math.random() * Math.PI * 2);
    }
  }

  rebuildFormation() {
    const spacing = CONFIG.GARY.FORMATION_SPACING;

    for (let i = 0; i < this.maxCount; i++) {
      if (i < this.count) {
        if (i === 0) {
          // 【相棒ゲイリー（メインゲイリー）】
          // もじさんのすぐ右隣（堂々と並走！）
          this.targetOffsets[i].set(1.35, 0, 0.1);
        } else if (i === 1) {
          // 2体目はもじさんの左隣
          this.targetOffsets[i].set(-1.35, 0, 0.1);
        } else if (i === 2) {
          // 3体目はもじさんのすぐ前
          this.targetOffsets[i].set(0.65, 0, -0.6);
        } else {
          // 4体目以降：もじさん＆相棒たちの周りに綺麗な扇形・スパイラル隊列
          const idx = i - 2;
          const goldenAngle = 2.39996;
          const radius = 1.2 + spacing * Math.sqrt(idx);
          const theta = idx * goldenAngle;

          const ox = Math.cos(theta) * radius * 0.95;
          const oz = 0.4 + Math.abs(Math.sin(theta)) * radius * 0.75 + (idx * 0.04);

          const clampedX = Math.max(-CONFIG.TRACK_WIDTH / 2 + 0.8, Math.min(CONFIG.TRACK_WIDTH / 2 - 0.8, ox));
          this.targetOffsets[i].set(clampedX, 0, oz);
        }
      } else {
        this.targetOffsets[i].set(0, -999, 0);
      }
    }
  }

  setCount(newCount) {
    const prevCount = this.count;
    this.count = Math.max(0, Math.min(this.maxCount, newCount));

    // 新しく増えたゲイリーはもじさんの位置から飛び出るように出現
    if (this.count > prevCount && this.positions[0]) {
      for (let i = prevCount; i < this.count; i++) {
        this.positions[i].copy(this.positions[0]);
        this.positions[i].x += (Math.random() - 0.5) * 0.8;
        this.positions[i].y += 1.2 + Math.random() * 0.6;
      }

      // 増殖時に相棒ゲイリーが喜ぶセリフ！
      if (this.count > prevCount + 4) {
        this.showSpeech(`ゲイリー +${this.count - prevCount}体！！`);
      }
    }

    this.rebuildFormation();
  }

  addCount(amount) {
    this.setCount(this.count + amount);
  }

  multiplyCount(multiplier) {
    this.setCount(Math.round(this.count * multiplier));
  }

  update(delta, mojiPos, isRunning) {
    this.bounceTime += delta * CONFIG.GARY.BOUNCE_SPEED;
    this.mesh.count = this.count;

    // セリフタイマーの更新
    if (this.speechTimer > 0) {
      this.speechTimer -= delta;
      if (this.speechTimer <= 0.5) {
        this.speechSprite.material.opacity = Math.max(0, this.speechTimer / 0.5);
      }
    } else if (isRunning && Math.random() < 0.003) {
      // たまにランダムで元気にしゃべる
      const line = this.speechLines[Math.floor(Math.random() * this.speechLines.length)];
      this.showSpeech(line);
    }

    // ゲイリー群集の更新
    for (let i = 0; i < this.count; i++) {
      const targetPos = this.targetOffsets[i];
      const currentPos = this.positions[i];

      // もじさんへの追従物理
      const desiredX = mojiPos.x + targetPos.x;
      const desiredZ = mojiPos.z + targetPos.z;

      currentPos.x += (desiredX - currentPos.x) * Math.min(1.0, delta * CONFIG.GARY.FOLLOW_LERP);
      currentPos.z += (desiredZ - currentPos.z) * Math.min(1.0, delta * (CONFIG.GARY.FOLLOW_LERP * 1.25));

      // ぽよぽよバウンス & スカッシュ（伸び縮み）
      let bounceY = 0;
      let scaleY = 1.0;
      let scaleXZ = 1.0;

      // 0番目の相棒ゲイリーはより大きく、高く元気に跳ねる！
      const isMainGary = (i === 0);
      const baseScale = isMainGary ? CONFIG.GARY.MAIN_SCALE : 1.0;
      const bounceHeight = isMainGary ? CONFIG.GARY.BOUNCE_HEIGHT * 1.25 : CONFIG.GARY.BOUNCE_HEIGHT;

      if (isRunning) {
        const phase = this.bounceTime + this.phaseOffsets[i];
        const sinVal = Math.sin(phase);
        bounceY = Math.max(0, sinVal) * bounceHeight;

        // バウンドに合わせてペコッと潰れてビヨーンと伸びる（アニメーション感UP）
        if (sinVal > 0) {
          scaleY = (1.0 + sinVal * 0.45) * baseScale;
          scaleXZ = (1.0 - sinVal * 0.22) * baseScale;
        } else {
          scaleY = (1.0 - Math.abs(sinVal) * 0.3) * baseScale;
          scaleXZ = (1.0 + Math.abs(sinVal) * 0.25) * baseScale;
        }
      } else {
        scaleY = baseScale;
        scaleXZ = baseScale;
      }

      currentPos.y = bounceY + CONFIG.GARY.BASE_RADIUS * 0.7 * baseScale;

      // 姿勢行列の更新
      this.dummy.position.set(currentPos.x, currentPos.y, currentPos.z);
      this.dummy.scale.set(scaleXZ, scaleY, scaleXZ);

      // ★重要★: カメラは斜め上手前（+Y, +Z）にあるため、
      // ゲイリーの顔（目と口）がプレイヤーにしっかり見えるようカメラ側に向ける！
      this.dummy.rotation.y = 0; // 手前(+Z)を向く
      this.dummy.rotation.x = -0.38; // やや上を向いてカメラと目を合わせる！
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(i, this.dummy.matrix);

      // 相棒ゲイリーの位置に吹き出しを追従
      if (isMainGary && this.speechSprite) {
        this.speechSprite.position.set(currentPos.x, currentPos.y + 1.6, currentPos.z);
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  getFrontPositions(sampleCount = 8) {
    const front = [];
    const countToPick = Math.min(this.count, sampleCount);
    for (let i = 0; i < countToPick; i++) {
      front.push(this.positions[i]);
    }
    return front;
  }

  reset() {
    this.count = CONFIG.GARY.INITIAL_COUNT;
    for (let i = 0; i < this.maxCount; i++) {
      this.positions[i].set(0, 0, 0);
    }
    if (this.speechSprite) this.speechSprite.material.opacity = 0;
    this.rebuildFormation();
  }
}

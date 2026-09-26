import Phaser from 'phaser'

export type StadiumUpdate = {
  ourScore: number
  theirScore: number
  inning: number
  half: 'top' | 'bottom'
  lastPlay: string
  event: 'idle' | 'play' | 'score' | 'win' | 'lose'
}

export class GameScene extends Phaser.Scene {
  private ball?: Phaser.GameObjects.Arc
  private batter?: Phaser.GameObjects.Container
  private scoreText?: Phaser.GameObjects.Text
  private statusText?: Phaser.GameObjects.Text
  private onUpdate = (event: Event) => this.renderUpdate((event as CustomEvent<StadiumUpdate>).detail)

  constructor() { super('stadium') }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#76a8c4')
    const g = this.add.graphics()
    g.fillStyle(0x315f48).fillRect(0, height * 0.3, width, height * 0.7)
    g.fillStyle(0xc99a62).fillTriangle(width / 2, height * 0.42, width * 0.12, height, width * 0.88, height)
    g.fillStyle(0xefe4c0).fillCircle(width / 2, height * 0.78, 8)
    g.lineStyle(3, 0xf4e7c5, 1)
    g.strokeTriangle(width / 2, height * 0.5, width * 0.22, height * 0.92, width * 0.78, height * 0.92)
    for (let x = 0; x < width; x += 20) {
      g.fillStyle(x % 40 === 0 ? 0x22374d : 0xd8c36d).fillRect(x, height * 0.25, 18, 12)
    }

    this.add.text(12, 10, 'NEKO STADIUM', { fontFamily: 'monospace', fontSize: '13px', color: '#f4e7c5', backgroundColor: '#13243a', padding: { x: 7, y: 4 } })
    this.scoreText = this.add.text(width - 12, 10, '0 - 0', { fontFamily: 'monospace', fontSize: '18px', color: '#f4e7c5', backgroundColor: '#13243a', padding: { x: 8, y: 4 } }).setOrigin(1, 0)

    this.addCat(width * 0.5, height * 0.48, 0xf0a64d, false)
    this.batter = this.addCat(width * 0.68, height * 0.74, 0xe9e1c7, true)
    this.ball = this.add.circle(width * 0.46, height * 0.57, 4, 0xffffff).setStrokeStyle(1, 0x13243a)
    this.statusText = this.add.text(width / 2, height - 18, 'プレイボール！', { fontFamily: 'monospace', fontSize: '12px', color: '#13243a', backgroundColor: '#f4e7c5', padding: { x: 8, y: 3 } }).setOrigin(0.5, 1)
    window.addEventListener('neko-stadium-update', this.onUpdate)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('neko-stadium-update', this.onUpdate))
  }

  private addCat(x: number, y: number, color: number, batter: boolean) {
    const body = this.add.container(x, y)
    const shadow = this.add.ellipse(0, 26, 42, 10, 0x13243a, 0.25)
    const torso = this.add.rectangle(0, 12, 30, 34, 0xf4e7c5).setStrokeStyle(2, 0x13243a)
    const head = this.add.circle(0, -12, 18, color).setStrokeStyle(2, 0x13243a)
    const earL = this.add.triangle(-12, -29, 0, 14, 11, 0, 18, 15, color).setStrokeStyle(2, 0x13243a)
    const earR = this.add.triangle(12, -29, 0, 15, 7, 0, 18, 14, color).setStrokeStyle(2, 0x13243a)
    const cap = this.add.rectangle(0, -28, 31, 8, 0x173454)
    const eyes = this.add.text(0, -17, '•  •', { fontFamily: 'monospace', fontSize: '9px', color: '#13243a' }).setOrigin(0.5)
    body.add([shadow, torso, head, earL, earR, cap, eyes])
    if (batter) {
      const bat = this.add.rectangle(-18, -3, 5, 55, 0x8d5b3c).setAngle(-28).setStrokeStyle(1, 0x13243a)
      body.add(bat)
    }
    return body
  }

  private renderUpdate(update: StadiumUpdate) {
    if (!this.ball || !this.batter) return
    this.scoreText?.setText(`${update.ourScore} - ${update.theirScore}`)
    this.statusText?.setText(`${update.inning}回${update.half === 'top' ? '表' : '裏'}  ${update.lastPlay}`)
    const { width, height } = this.scale
    this.tweens.killTweensOf(this.ball)
    this.ball.setPosition(width * 0.46, height * 0.57).setAlpha(1)
    this.tweens.add({ targets: this.ball, x: width * 0.66, y: height * 0.68, duration: 280, yoyo: update.event === 'play' })
    this.tweens.add({ targets: this.batter, angle: update.event === 'play' || update.event === 'score' ? 8 : 0, duration: 140, yoyo: true })
    if (update.event === 'score') {
      this.tweens.add({ targets: this.cameras.main, zoom: 1.04, duration: 100, yoyo: true })
    }
  }
}

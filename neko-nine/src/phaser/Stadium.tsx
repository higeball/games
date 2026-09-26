import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { GameScene } from './GameScene'

export function Stadium() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!host.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 390,
      height: 280,
      transparent: false,
      pixelArt: true,
      antialias: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [GameScene],
      render: { roundPixels: true }
    })
    return () => game.destroy(true)
  }, [])

  return <div className="stadium" ref={host} aria-label="猫野球の球場" />
}

import type { CSSProperties } from 'react'

export function YasuPortrait({ mood = 0, className = '' }: { mood?: number; className?: string }) {
  const style = { '--frame': Math.max(0, Math.min(3, mood)) } as CSSProperties
  return <div className={`yasu-sprite ${className}`} style={style} role="img" aria-label="ヤス監督" />
}

export function CatPortrait({ index, className = '' }: { index: number; className?: string }) {
  const style = { '--cat-frame': Math.max(0, Math.min(8, index)) } as CSSProperties
  return <div className={`cat-sprite ${className}`} style={style} role="img" aria-label="猫選手" />
}

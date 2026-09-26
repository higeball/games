import type { CSSProperties } from 'react'
import yasuSheet from '../assets/characters/yasu-pixel-sheet.png'
import catSheet from '../assets/characters/cat-player-sheet.png'

export function YasuPortrait({ mood = 0, className = '', style: extraStyle = {} }: { mood?: number; className?: string; style?: CSSProperties }) {
  const style = {
    '--frame': Math.max(0, Math.min(3, mood)),
    backgroundImage: `url(${yasuSheet})`,
    ...extraStyle
  } as CSSProperties
  return <div className={`yasu-sprite ${className}`} style={style} role="img" aria-label="ヤス監督" />
}

export function CatPortrait({ index, className = '', style: extraStyle = {} }: { index: number; className?: string; style?: CSSProperties }) {
  const style = {
    '--cat-frame': Math.max(0, Math.min(8, index)),
    backgroundImage: `url(${catSheet})`,
    ...extraStyle
  } as CSSProperties
  return <div className={`cat-sprite ${className}`} style={style} role="img" aria-label="猫選手" />
}

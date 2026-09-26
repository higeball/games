import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export type StadiumUpdate = {
  ourScore: number
  theirScore: number
  inning: number
  half: 'top' | 'bottom'
  lastPlay: string
  event: 'idle' | 'play' | 'score' | 'win' | 'lose'
}

export function Stadium3D() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || 390
    const height = container.clientHeight || 220

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    container.appendChild(canvas)

    let renderer: THREE.WebGLRenderer | null = null
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      })
      renderer.setSize(width, height, false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
    } catch (e) {
      console.warn('WebGL init failed, switching to 2D canvas stadium:', e)
    }

    // ── FALLBACK 2D CANVAS STADIUM (When WebGL unavailable) ──
    if (!renderer) {
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      let ballX = width * 0.5
      let ballY = height * 0.55
      let ballAnim = false
      let ballStart = 0
      let ballType: 'hit' | 'homer' | 'strikeout' = 'hit'
      let jumboText = '★ NEKO STADIUM ★'
      let jumboSub = 'PLAY BALL !!'

      const draw2D = () => {
        if (!ctx) return
        ctx.fillStyle = '#091424'
        ctx.fillRect(0, 0, width, height)

        // Light beams
        ctx.fillStyle = 'rgba(255, 250, 220, 0.08)'
        ctx.beginPath()
        ctx.moveTo(width * 0.1, height * 0.2)
        ctx.lineTo(width * 0.7, height)
        ctx.lineTo(width * 0.3, height)
        ctx.closePath()
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(width * 0.9, height * 0.2)
        ctx.lineTo(width * 0.3, height)
        ctx.lineTo(width * 0.7, height)
        ctx.closePath()
        ctx.fill()

        // Outfield wall
        ctx.fillStyle = '#143428'
        ctx.beginPath()
        ctx.arc(width * 0.5, height * 0.9, height * 0.75, Math.PI, 0, false)
        ctx.fill()

        ctx.strokeStyle = '#facc15'
        ctx.lineWidth = 3
        ctx.stroke()

        // Outfield grass
        ctx.fillStyle = '#225c38'
        ctx.beginPath()
        ctx.arc(width * 0.5, height * 0.9, height * 0.72, Math.PI, 0, false)
        ctx.fill()

        // Infield dirt diamond
        ctx.fillStyle = '#b57842'
        ctx.beginPath()
        ctx.moveTo(width * 0.5, height * 0.88) // Home
        ctx.lineTo(width * 0.8, height * 0.6) // 1B
        ctx.lineTo(width * 0.5, height * 0.34) // 2B
        ctx.lineTo(width * 0.2, height * 0.6) // 3B
        ctx.closePath()
        ctx.fill()

        // Inner grass
        ctx.fillStyle = '#2e6f46'
        ctx.beginPath()
        ctx.moveTo(width * 0.5, height * 0.8)
        ctx.lineTo(width * 0.7, height * 0.6)
        ctx.lineTo(width * 0.5, height * 0.42)
        ctx.lineTo(width * 0.3, height * 0.6)
        ctx.closePath()
        ctx.fill()

        // Mound
        ctx.fillStyle = '#9e6231'
        ctx.beginPath()
        ctx.arc(width * 0.5, height * 0.58, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.fillRect(width * 0.5 - 5, height * 0.58 - 2, 10, 3)

        // Bases
        ctx.fillStyle = '#fff'
        ctx.fillRect(width * 0.8 - 4, height * 0.6 - 4, 8, 8)
        ctx.fillRect(width * 0.5 - 4, height * 0.34 - 4, 8, 8)
        ctx.fillRect(width * 0.2 - 4, height * 0.6 - 4, 8, 8)
        ctx.fillRect(width * 0.5 - 5, height * 0.88 - 5, 10, 10)

        // Scoreboard tower in center
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(width * 0.5 - 60, height * 0.05, 120, 26)
        ctx.strokeStyle = '#ffd700'
        ctx.lineWidth = 1.5
        ctx.strokeRect(width * 0.5 - 60, height * 0.05, 120, 26)
        ctx.fillStyle = '#ffd700'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(jumboText, width * 0.5, height * 0.05 + 12)
        ctx.fillStyle = '#4ade80'
        ctx.font = 'bold 9px monospace'
        ctx.fillText(jumboSub, width * 0.5, height * 0.05 + 22)

        // Pitcher (cat)
        ctx.fillStyle = '#ea580c'
        ctx.beginPath()
        ctx.arc(width * 0.5, height * 0.55, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1d3a5a'
        ctx.fillRect(width * 0.5 - 6, height * 0.55 - 10, 12, 5)

        // Batter (cat)
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(width * 0.56, height * 0.86, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1d3a5a'
        ctx.fillRect(width * 0.56 - 6, height * 0.86 - 11, 12, 5)
        // Bat
        ctx.strokeStyle = '#b45309'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(width * 0.56 - 4, height * 0.86)
        ctx.lineTo(width * 0.56 - 14, height * 0.86 - 12)
        ctx.stroke()

        // Ball
        if (ballAnim) {
          const t = Math.min(1, (performance.now() - ballStart) / 1000)
          if (ballType === 'homer') {
            ballX = width * 0.5 + Math.sin(t * Math.PI) * 40
            ballY = height * 0.86 - t * (height * 0.8)
          } else if (ballType === 'hit') {
            ballX = width * 0.5 + t * 70
            ballY = height * 0.86 - t * (height * 0.5)
          } else {
            ballX = width * 0.5
            ballY = height * 0.58 + t * (height * 0.3)
          }
          if (t >= 1) ballAnim = false
        } else {
          ballX = width * 0.5
          ballY = height * 0.58
        }
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(ballX, ballY, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }

      let reqId: number
      const loop = () => {
        draw2D()
        reqId = requestAnimationFrame(loop)
      }
      loop()

      const onUpdate = (e: Event) => {
        const detail = (e as CustomEvent<StadiumUpdate>).detail
        if (!detail) return
        if (detail.event === 'score') {
          ballAnim = true
          ballStart = performance.now()
          ballType = 'homer'
          jumboText = '★ HOMERUN !! ★'
          jumboSub = `${detail.ourScore} - ${detail.theirScore}`
        } else if (detail.event === 'play') {
          ballAnim = true
          ballStart = performance.now()
          ballType = detail.lastPlay?.includes('三振') ? 'strikeout' : 'hit'
          jumboText = '★ PLAY BALL ★'
          jumboSub = `${detail.ourScore} - ${detail.theirScore}`
        }
      }
      window.addEventListener('neko-stadium-update', onUpdate)

      return () => {
        cancelAnimationFrame(reqId)
        window.removeEventListener('neko-stadium-update', onUpdate)
        if (canvas.parentNode === container) container.removeChild(canvas)
      }
    }

    // ── FULL THREE.JS 3D BASEBALL STADIUM ──
    // 1. Scene & Atmosphere
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x091424) // Night stadium sky
    scene.fog = new THREE.FogExp2(0x0c1e36, 0.006)

    // 2. Camera (Broadcast view)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 600)
    camera.position.set(0, 18, 42)
    camera.lookAt(0, 2, -10)

    // 3. Lighting - Stadium Night Floodlights
    const ambientLight = new THREE.AmbientLight(0x2a3e5c, 1.4)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xfff6e5, 2.2)
    dirLight.position.set(25, 45, 20)
    dirLight.castShadow = true
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight(0x9fc5e8, 1.2)
    fillLight.position.set(-30, 40, -10)
    scene.add(fillLight)

    // 4. Materials
    const grassDarkMat = new THREE.MeshLambertMaterial({ color: 0x225c38 })
    const grassLightMat = new THREE.MeshLambertMaterial({ color: 0x2e6f46 })
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0xb57842 })
    const chalkMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x143428 })
    const fenceTopMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    const standMat = new THREE.MeshLambertMaterial({ color: 0x1e3247 })
    const standSeatMat = new THREE.MeshLambertMaterial({ color: 0x2a445e })
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x64748b })
    const lightGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 })

    // 5. Outfield Grass
    const grassGroup = new THREE.Group()
    scene.add(grassGroup)

    const outfieldRadius = 65
    const outfieldGeo = new THREE.CircleGeometry(outfieldRadius, 40, Math.PI * 0.25, Math.PI * 0.5)
    const outfieldMesh = new THREE.Mesh(outfieldGeo, grassDarkMat)
    outfieldMesh.rotation.x = -Math.PI / 2
    outfieldMesh.receiveShadow = true
    grassGroup.add(outfieldMesh)

    for (let r = 25; r < outfieldRadius; r += 7) {
      const ringGeo = new THREE.RingGeometry(r, r + 3.5, 32, 1, Math.PI * 0.25, Math.PI * 0.5)
      const ringMesh = new THREE.Mesh(ringGeo, grassLightMat)
      ringMesh.rotation.x = -Math.PI / 2
      ringMesh.position.y = 0.02
      ringMesh.receiveShadow = true
      grassGroup.add(ringMesh)
    }

    // Infield Dirt Diamond
    const dirtShape = new THREE.Shape()
    dirtShape.moveTo(0, 0)
    dirtShape.lineTo(20, -20)
    dirtShape.lineTo(0, -40)
    dirtShape.lineTo(-20, -20)
    dirtShape.closePath()

    const dirtMesh = new THREE.Mesh(new THREE.ShapeGeometry(dirtShape), dirtMat)
    dirtMesh.rotation.x = -Math.PI / 2
    dirtMesh.position.set(0, 0.03, 0)
    dirtMesh.receiveShadow = true
    scene.add(dirtMesh)

    // Inner grass
    const innerGrassShape = new THREE.Shape()
    innerGrassShape.moveTo(0, -5)
    innerGrassShape.lineTo(13, -18)
    innerGrassShape.lineTo(0, -31)
    innerGrassShape.lineTo(-13, -18)
    innerGrassShape.closePath()

    const innerGrassMesh = new THREE.Mesh(new THREE.ShapeGeometry(innerGrassShape), grassDarkMat)
    innerGrassMesh.rotation.x = -Math.PI / 2
    innerGrassMesh.position.set(0, 0.05, 0)
    innerGrassMesh.receiveShadow = true
    scene.add(innerGrassMesh)

    // Mound & Rubber
    const moundMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.4, 0.45, 20), dirtMat)
    moundMesh.position.set(0, 0.2, -18)
    scene.add(moundMesh)

    const rubberMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.4), chalkMat)
    rubberMesh.position.set(0, 0.45, -18)
    scene.add(rubberMesh)

    // Home Plate & Bases
    const homeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.4), chalkMat)
    homeMesh.position.set(0, 0.06, 0)
    homeMesh.rotation.y = Math.PI * 0.25
    scene.add(homeMesh)

    const baseGeo = new THREE.BoxGeometry(1.2, 0.25, 1.2)
    const base1 = new THREE.Mesh(baseGeo, chalkMat)
    base1.position.set(13.5, 0.15, -13.5)
    base1.rotation.y = Math.PI * 0.25
    scene.add(base1)

    const base2 = new THREE.Mesh(baseGeo, chalkMat)
    base2.position.set(0, 0.15, -27)
    base2.rotation.y = Math.PI * 0.25
    scene.add(base2)

    const base3 = new THREE.Mesh(baseGeo, chalkMat)
    base3.position.set(-13.5, 0.15, -13.5)
    base3.rotation.y = Math.PI * 0.25
    scene.add(base3)

    // Outfield Wall & Foul Poles
    const wallCurve = new THREE.CylinderGeometry(outfieldRadius, outfieldRadius, 3.2, 32, 1, true, Math.PI * 0.25, Math.PI * 0.5)
    const wallMesh = new THREE.Mesh(wallCurve, fenceMat)
    wallMesh.position.set(0, 1.6, 0)
    scene.add(wallMesh)

    const railCurve = new THREE.CylinderGeometry(outfieldRadius + 0.1, outfieldRadius + 0.1, 0.25, 32, 1, true, Math.PI * 0.25, Math.PI * 0.5)
    const railMesh = new THREE.Mesh(railCurve, fenceTopMat)
    railMesh.position.set(0, 3.25, 0)
    scene.add(railMesh)

    const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 14, 6)
    const poleMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    const leftPole = new THREE.Mesh(poleGeo, poleMat)
    leftPole.position.set(-45.96, 7, -45.96)
    scene.add(leftPole)

    const rightPole = new THREE.Mesh(poleGeo, poleMat)
    rightPole.position.set(45.96, 7, -45.96)
    scene.add(rightPole)

    // Grandstands
    for (let tier = 0; tier < 3; tier++) {
      const standRadius = outfieldRadius + 3 + tier * 5
      const standHeight = 2.5 + tier * 3.5
      const standGeo = new THREE.CylinderGeometry(standRadius, standRadius, standHeight, 32, 1, true, Math.PI * 0.24, Math.PI * 0.52)
      const standMesh = new THREE.Mesh(standGeo, tier % 2 === 0 ? standMat : standSeatMat)
      standMesh.position.set(0, standHeight / 2, 0)
      scene.add(standMesh)
    }

    // 4 Floodlight Towers
    const towerPositions = [
      { x: -50, z: -35 },
      { x: 50, z: -35 },
      { x: -28, z: 12 },
      { x: 28, z: 12 }
    ]
    towerPositions.forEach(pos => {
      const towerGroup = new THREE.Group()
      towerGroup.position.set(pos.x, 0, pos.z)

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 34, 6), towerMat)
      mast.position.y = 17
      towerGroup.add(mast)

      const bank = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 1.2), towerMat)
      bank.position.set(0, 33, 0)
      bank.lookAt(0, 0, -15)
      towerGroup.add(bank)

      const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.5), lightGlowMat)
      glow.position.set(0, 0, 0.65)
      bank.add(glow)

      const pLight = new THREE.PointLight(0xfffae0, 0.8, 80)
      pLight.position.set(0, 32, 0)
      towerGroup.add(pLight)

      scene.add(towerGroup)
    })

    // Scoreboard in Center Field
    const boardGroup = new THREE.Group()
    boardGroup.position.set(0, 0, -outfieldRadius - 4)
    const boardPillars = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 2), standMat)
    boardPillars.position.y = 6
    boardGroup.add(boardPillars)

    const boardScreen = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 2.5), new THREE.MeshLambertMaterial({ color: 0x091424 }))
    boardScreen.position.y = 16
    boardGroup.add(boardScreen)

    const jumbotronCanvas = document.createElement('canvas')
    jumbotronCanvas.width = 512
    jumbotronCanvas.height = 256
    const jCtx = jumbotronCanvas.getContext('2d')
    if (jCtx) {
      jCtx.fillStyle = '#06101e'
      jCtx.fillRect(0, 0, 512, 256)
      jCtx.strokeStyle = '#ffd700'
      jCtx.lineWidth = 6
      jCtx.strokeRect(8, 8, 496, 240)
      jCtx.fillStyle = '#f5c34b'
      jCtx.font = 'bold 36px monospace'
      jCtx.textAlign = 'center'
      jCtx.fillText('★ NEKO STADIUM ★', 256, 60)
      jCtx.fillStyle = '#ffffff'
      jCtx.font = '28px monospace'
      jCtx.fillText('NINE LIVES. ONE DREAM.', 256, 115)
      jCtx.fillStyle = '#4ade80'
      jCtx.font = 'bold 34px monospace'
      jCtx.fillText('PLAY BALL !!', 256, 185)
    }
    const jumbotronTexture = new THREE.CanvasTexture(jumbotronCanvas)
    const jumbotronFace = new THREE.Mesh(
      new THREE.PlaneGeometry(21, 9.2),
      new THREE.MeshBasicMaterial({ map: jumbotronTexture })
    )
    jumbotronFace.position.set(0, 16, 1.3)
    boardGroup.add(jumbotronFace)
    scene.add(boardGroup)

    // 3D Cat Models
    function createCatModel(color: number, isBatter: boolean) {
      const cat = new THREE.Group()

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 2.2, 10), new THREE.MeshLambertMaterial({ color: 0xf8f9fa }))
      body.position.y = 1.6
      cat.add(body)

      const headMat = new THREE.MeshLambertMaterial({ color })
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 12), headMat)
      head.position.y = 3.3
      cat.add(head)

      const earGeo = new THREE.ConeGeometry(0.38, 0.7, 4)
      const earL = new THREE.Mesh(earGeo, headMat)
      earL.position.set(-0.6, 4.15, 0.1)
      earL.rotation.z = 0.25
      cat.add(earL)

      const earR = new THREE.Mesh(earGeo, headMat)
      earR.position.set(0.6, 4.15, 0.1)
      earR.rotation.z = -0.25
      cat.add(earR)

      const capMat = new THREE.MeshLambertMaterial({ color: 0x1d3a5a })
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.08, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), capMat)
      cap.position.y = 3.35
      cat.add(cap)

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.7), capMat)
      visor.position.set(0, 3.8, isBatter ? -0.8 : 0.8)
      cat.add(visor)

      if (isBatter) {
        const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.08, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0xb45309 }))
        bat.position.set(-1.2, 3.0, 0.4)
        bat.rotation.x = -0.6
        bat.rotation.z = 0.4
        cat.add(bat)
      } else {
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.42, 6, 6), new THREE.MeshLambertMaterial({ color: 0x78350f }))
        glove.position.set(-1.1, 2.0, 0.3)
        cat.add(glove)
      }

      return cat
    }

    const pitcher = createCatModel(0xea580c, false)
    pitcher.position.set(0, 0.4, -18)
    scene.add(pitcher)

    const batter = createCatModel(0xf59e0b, true)
    batter.position.set(2.2, 0, 0)
    batter.rotation.y = Math.PI
    scene.add(batter)

    const catcher = createCatModel(0x0284c7, true)
    catcher.position.set(0, 0, 3.5)
    catcher.scale.set(0.85, 0.75, 0.85)
    scene.add(catcher)

    // 3D Baseball Ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    ball.position.set(0, 2.4, -17)
    scene.add(ball)

    let ballAnimating = false
    let ballStartTime = 0
    let ballTrajectoryType: 'pitch' | 'homer' | 'hit' | 'strikeout' = 'pitch'

    function triggerBallAction(type: 'pitch' | 'homer' | 'hit' | 'strikeout') {
      ballAnimating = true
      ballStartTime = performance.now()
      ballTrajectoryType = type
      ball.position.set(0, 2.4, -17)
    }

    const onStadiumUpdate = (e: Event) => {
      const detail = (e as CustomEvent<StadiumUpdate>).detail
      if (!detail) return

      if (detail.event === 'score') {
        triggerBallAction('homer')
        if (jCtx) {
          jCtx.fillStyle = '#06101e'
          jCtx.fillRect(0, 0, 512, 256)
          jCtx.strokeStyle = '#ffd700'
          jCtx.lineWidth = 6
          jCtx.strokeRect(8, 8, 496, 240)
          jCtx.fillStyle = '#ef4444'
          jCtx.font = 'bold 44px monospace'
          jCtx.textAlign = 'center'
          jCtx.fillText('★ HOMERUN !! ★', 256, 80)
          jCtx.fillStyle = '#facc15'
          jCtx.font = 'bold 36px monospace'
          jCtx.fillText(`NEKO ${detail.ourScore} - ${detail.theirScore}`, 256, 145)
          jCtx.fillStyle = '#ffffff'
          jCtx.font = '24px monospace'
          jCtx.fillText(detail.lastPlay || '特大ホームラン！！', 256, 205)
          jumbotronTexture.needsUpdate = true
        }
      } else if (detail.event === 'play') {
        triggerBallAction(detail.lastPlay?.includes('三振') ? 'strikeout' : 'hit')
        if (jCtx) {
          jCtx.fillStyle = '#06101e'
          jCtx.fillRect(0, 0, 512, 256)
          jCtx.strokeStyle = '#38bdf8'
          jCtx.lineWidth = 6
          jCtx.strokeRect(8, 8, 496, 240)
          jCtx.fillStyle = '#38bdf8'
          jCtx.font = 'bold 38px monospace'
          jCtx.textAlign = 'center'
          jCtx.fillText('PLAY BALL', 256, 75)
          jCtx.fillStyle = '#ffffff'
          jCtx.font = 'bold 32px monospace'
          jCtx.fillText(`NEKO ${detail.ourScore} - ${detail.theirScore}`, 256, 140)
          jCtx.fillStyle = '#facc15'
          jCtx.font = '22px monospace'
          jCtx.fillText(detail.lastPlay?.slice(0, 24) || '試合中', 256, 200)
          jumbotronTexture.needsUpdate = true
        }
      }
    }
    window.addEventListener('neko-stadium-update', onStadiumUpdate)

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        if (w > 0 && h > 0) {
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h, false)
        }
      }
    })
    resizeObserver.observe(container)

    let animId: number
    const clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      camera.position.x = Math.sin(elapsed * 0.4) * 1.8
      camera.position.y = 17.5 + Math.cos(elapsed * 0.3) * 0.6
      camera.lookAt(0, 2, -12)

      pitcher.position.y = 0.4 + Math.sin(elapsed * 3.0) * 0.05
      batter.rotation.z = Math.sin(elapsed * 2.0) * 0.04

      if (ballAnimating) {
        const t = (performance.now() - ballStartTime) / 1000
        if (ballTrajectoryType === 'homer') {
          const dur = 2.2
          const progress = Math.min(1, t / dur)
          ball.position.x = Math.sin(progress * 1.5) * 8
          ball.position.z = -17 + (17 - (-65)) * progress
          ball.position.y = 2.4 + Math.sin(progress * Math.PI) * 28
          if (progress >= 1) {
            ballAnimating = false
            ball.position.set(0, 2.4, -17)
          }
        } else if (ballTrajectoryType === 'hit') {
          const dur = 1.4
          const progress = Math.min(1, t / dur)
          ball.position.x = (progress < 0.25 ? 0 : (progress - 0.25) * 28)
          ball.position.z = -17 + 22 * progress
          ball.position.y = 2.4 + Math.sin(progress * Math.PI) * 6
          if (progress >= 1) {
            ballAnimating = false
            ball.position.set(0, 2.4, -17)
          }
        } else {
          const dur = 0.8
          const progress = Math.min(1, t / dur)
          ball.position.x = 0
          ball.position.z = -17 + 20 * progress
          ball.position.y = 2.4 - 1.2 * progress
          if (progress >= 1) {
            ballAnimating = false
            ball.position.set(0, 2.4, -17)
          }
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('neko-stadium-update', onStadiumUpdate)
      resizeObserver.disconnect()
      renderer.dispose()
      if (canvas.parentNode === container) {
        container.removeChild(canvas)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="stadium-3d-canvas"
      aria-label="3Dリアル野球場"
      style={{ width: '100%', height: '100%', minHeight: '190px', position: 'relative' }}
    />
  )
}

/**
 * プレビュー用のthree.jsシーン。
 * 背景はcanvasを透過させ、CSS側の面色をそのまま見せる。
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function createViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    // PS1風の狙いに合わせてアンチエイリアスは切る
    antialias: false,
    // PNG書き出しでcanvasを読み出すために必要
    preserveDrawingBuffer: true,
  })
  renderer.setClearColor(0x000000, 0)

  const basePixelRatio = Math.min(window.devicePixelRatio, 2)
  let renderScale = 1
  renderer.setPixelRatio(basePixelRatio)

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100)
  camera.position.set(0, 1.05, 3.2)

  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 0.9, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 0.6
  controls.maxDistance = 12

  // マテリアルがアンリットでない場合に備えた最小限のライト
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(1.5, 2.5, 2)
  scene.add(key)
  scene.add(new THREE.HemisphereLight(0xbfc4cc, 0x3a3630, 1.1))

  /** 背景の見え方。床の線の色も一緒に変える（白背景に暗い線は読めるが逆は読めない）。 */
  const BACKDROPS = {
    dark: { clear: 0x15130f, grid: [0x4a443c, 0x322e29], opacity: 0.55 },
    light: { clear: 0xeeebe4, grid: [0x9a9288, 0xc4beb3], opacity: 0.7 },
  }

  let backdrop = 'dark'
  let backgroundTexture = null

  const ground = new THREE.GridHelper(6, 12, ...BACKDROPS.dark.grid)
  ground.material.transparent = true
  ground.material.opacity = BACKDROPS.dark.opacity
  scene.add(ground)

  function applyBackdrop() {
    const preset = BACKDROPS[backdrop] ?? BACKDROPS.dark
    renderer.setClearColor(preset.clear, 1)
    ground.material.color.setHex(preset.grid[0])
    ground.material.opacity = preset.opacity
    // GridHelperは中心線と目盛りで頂点カラーを使うため、両方入れ替える
    const colors = ground.geometry.attributes.color
    if (colors) {
      const center = new THREE.Color(preset.grid[0])
      const outer = new THREE.Color(preset.grid[1])
      for (let i = 0; i < colors.count; i += 1) {
        const c = i < 12 ? center : outer
        colors.setXYZ(i, c.r, c.g, c.b)
      }
      colors.needsUpdate = true
    }
  }

  applyBackdrop()

  // 生成物はこのグループの下だけに置き、差し替え時はここを空にする
  const modelRoot = new THREE.Group()
  scene.add(modelRoot)

  /**
   * 背景画像の縦横比を合わせる。
   * three.jsは背景テクスチャを画面いっぱいに引き伸ばすため、
   * repeat/offset で切り出す範囲を調整して「はみ出す側を切る」挙動にする。
   */
  function fitBackground() {
    if (!backgroundTexture?.image) return
    const view = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    const source = backgroundTexture.image.width / backgroundTexture.image.height
    const ratio = source / view

    if (ratio > 1) {
      backgroundTexture.repeat.set(1 / ratio, 1)
      backgroundTexture.offset.set((1 - 1 / ratio) / 2, 0)
    } else {
      backgroundTexture.repeat.set(1, ratio)
      backgroundTexture.offset.set(0, (1 - ratio) / 2)
    }
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    fitBackground()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()

  // r184でTimerはaddonsからコアへ移動している（Clockは非推奨）
  const timer = new THREE.Timer()
  const frameCallbacks = new Set()

  renderer.setAnimationLoop((time) => {
    timer.update(time)
    const delta = timer.getDelta()
    for (const fn of frameCallbacks) fn(delta)
    controls.update()
    renderer.render(scene, camera)
  })

  return {
    scene,
    camera,
    renderer,
    controls,
    modelRoot,

    /** modelRootの中身を差し替える。以前のジオメトリ/マテリアルは破棄する。 */
    setModel(object3d) {
      for (const child of [...modelRoot.children]) {
        modelRoot.remove(child)
        disposeTree(child)
      }
      if (object3d) modelRoot.add(object3d)
    },

    /** 対象がちょうど収まるようカメラを寄せる。 */
    frame(object3d, padding = 1.35) {
      const box = new THREE.Box3().setFromObject(object3d)
      if (box.isEmpty()) return
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const radius = Math.max(size.x, size.y, size.z) * 0.5
      const distance =
        (radius * padding) / Math.sin((camera.fov * Math.PI) / 360)

      controls.target.copy(center)
      camera.position.set(center.x, center.y + size.y * 0.08, center.z + distance)
      camera.near = Math.max(distance / 100, 0.01)
      camera.far = distance * 20
      camera.updateProjectionMatrix()
      controls.update()
    },

    onFrame(fn) {
      frameCallbacks.add(fn)
      return () => frameCallbacks.delete(fn)
    },

    /**
     * 内部の描画解像度を落として引き伸ばす（PS1の低解像度表現）。
     * 拡大はブラウザ任せにし、CSSのimage-renderingでニアレストにする。
     */
    setRenderScale(scale) {
      renderScale = scale
      // 倍率はCSSピクセル基準にする。devicePixelRatioを掛けると、
      // 高DPI環境で「0.5倍」がretinaを打ち消すだけになり粗さが出ない
      renderer.setPixelRatio(scale === 1 ? basePixelRatio : scale)
      canvas.dataset.pixelated = scale < 1 ? 'true' : 'false'
      resize()
    },

    getRenderScale() {
      return renderScale
    },

    /** 背景の明暗。'dark' か 'light'。 */
    setBackdrop(next) {
      backdrop = next
      applyBackdrop()
    },

    /**
     * 背景画像。null で色に戻す。
     * canvasいっぱいに、縦横比を保って敷き詰める（はみ出す側を切る）。
     */
    setBackgroundImage(image) {
      backgroundTexture?.dispose()
      backgroundTexture = null
      scene.background = null

      if (!image) return
      backgroundTexture = new THREE.Texture(image)
      backgroundTexture.colorSpace = THREE.SRGBColorSpace
      backgroundTexture.needsUpdate = true
      scene.background = backgroundTexture
      fitBackground()
    },

    /** 床のグリッドの表示。 */
    setGroundVisible(visible) {
      ground.visible = visible
    },

    /** PNG書き出しで背景を外すときに使う。 */
    suspendBackground() {
      const saved = { background: scene.background, alpha: renderer.getClearAlpha() }
      scene.background = null
      renderer.setClearAlpha(0)
      return () => {
        scene.background = saved.background
        renderer.setClearAlpha(saved.alpha)
      }
    },

    dispose() {
      observer.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      renderer.dispose()
    },
  }
}

function disposeTree(root) {
  root.traverse((node) => {
    node.geometry?.dispose()
    const material = node.material
    if (!material) return
    for (const m of Array.isArray(material) ? material : [material]) {
      m.map?.dispose()
      m.dispose()
    }
  })
}

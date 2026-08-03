/**
 * 書き出し。.glb はBlender等へ、.png はSNSアイコン用。
 */
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

/**
 * SkinnedMeshとボーン階層を含む単一ファイルの .glb を書き出す。
 * binary:true でテクスチャも同梱されるため、Blenderへは1ファイルで持ち込める。
 */
export async function exportGLB(object3d, filename) {
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(object3d, {
    binary: true,
    onlyVisible: false,
  })
  const blob = new Blob([result], { type: 'model/gltf-binary' })
  download(blob, filename)
  return blob.size
}

/**
 * プレビューを正方形で切り出してPNGにする。
 * レンダラのサイズを一時的に変えて描き直し、終わったら元に戻す。
 */
export async function exportPNG(viewer, { size = 1024, transparent = true, filename }) {
  const { renderer, camera } = viewer
  const previous = { width: renderer.domElement.width, height: renderer.domElement.height }
  const previousAspect = camera.aspect
  const previousPixelRatio = renderer.getPixelRatio()

  // プレビューと同じ粗さで書き出すため、低解像度で描いてから引き伸ばす
  const scale = viewer.getRenderScale()
  const drawSize = Math.max(64, Math.round(size * scale))

  // 透過で出すときは背景（色・画像）を外す
  const restoreBackground = transparent ? viewer.suspendBackground() : null

  renderer.setPixelRatio(1)
  renderer.setSize(drawSize, drawSize, false)
  camera.aspect = 1
  camera.updateProjectionMatrix()
  renderer.render(viewer.scene, camera)

  const blob = await canvasToBlob(renderer.domElement, transparent, size)
  restoreBackground?.()

  // 元のサイズに戻す（ResizeObserverを待たず即座に復帰させる）
  renderer.setPixelRatio(previousPixelRatio)
  renderer.setSize(previous.width, previous.height, false)
  camera.aspect = previousAspect
  camera.updateProjectionMatrix()

  download(blob, filename)
  return blob.size
}

async function canvasToBlob(canvas, transparent, outputSize) {
  if (transparent && canvas.width === outputSize) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }

  const out = document.createElement('canvas')
  out.width = outputSize
  out.height = outputSize
  const ctx = out.getContext('2d')

  if (!transparent) {
    ctx.fillStyle = '#1b1917'
    ctx.fillRect(0, 0, outputSize, outputSize)
  }

  // 粗いドットを保ったまま拡大する
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, 0, 0, outputSize, outputSize)
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // クリック処理がURLを掴むまで少し待ってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function timestamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

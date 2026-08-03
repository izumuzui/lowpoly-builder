/**
 * 写真 → 顔検出 → 位置合わせ → UVアトラスの顔領域へ転写。
 *
 * 生成AIによる描き直しはしない。写真をそのまま貼ることで、
 * リアルな顔がカクカクの体に乗る違和感（狙いの質感）を残す。
 * 128pxまで落とすため、切り抜きの粗さはむしろ味になる。
 */
import { MEDIAPIPE_WASM_BASE, FACE_DETECTOR_MODEL } from './config.js'
import { region, quantize15bit, drawPlaceholderFace, FACE_ANCHOR } from './atlas.js'

const { eyeSpan: EYE_SPAN, eyeLine: EYE_LINE } = FACE_ANCHOR

let detectorPromise = null

/**
 * 初回だけMediaPipe本体・WASM・モデルを取得する。以降は使い回す。
 *
 * MediaPipeは静的importにせず、写真が実際に選ばれてから読み込む。
 * three.jsと違いvendor化していない（WASMが11.5MBあり重すぎる）ため、
 * 体型を見るだけの利用で外部通信が発生しないようにしている。
 */
export function loadDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import('mediapipe-vision')
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE)
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      })
    })().catch((error) => {
      // 失敗を握ったままにすると次回以降ずっと失敗するので解除する
      detectorPromise = null
      throw error
    })
  }
  return detectorPromise
}

/**
 * 画像から顔を1つ見つける。複数写っている場合は最も大きいものを採用する。
 * @returns {{ eyes: [{x:number,y:number},{x:number,y:number}], box: object } | null}
 */
export async function detectFace(source) {
  const detector = await loadDetector()
  const { detections } = detector.detect(source)
  if (!detections?.length) return null

  const best = detections.reduce((a, b) => (boxArea(b) > boxArea(a) ? b : a))
  const width = source.width ?? source.naturalWidth
  const height = source.height ?? source.naturalHeight

  // BlazeFaceのkeypointsは先頭2点が両目。正規化座標なのでピクセルに戻す
  const eyes = best.keypoints
    .slice(0, 2)
    .map((point) => ({ x: point.x * width, y: point.y * height }))
    .sort((a, b) => a.x - b.x)

  if (eyes.length < 2) return null
  return { eyes, box: best.boundingBox }
}

function boxArea(detection) {
  const box = detection.boundingBox
  return box ? box.width * box.height : 0
}

/**
 * 検出結果をもとに、写真を顔領域へ相似変換（回転・拡大縮小・平行移動）で転写する。
 * 透視変形やランドマーク単位のワープはしない。素朴なほど狙いの質感に近い。
 */
export function paintFace(atlas, source, detection) {
  const [rx, ry, rw, rh] = region('face')
  const [left, right] = detection.eyes

  const dx = right.x - left.x
  const dy = right.y - left.y
  const angle = Math.atan2(dy, dx)
  const eyeDistance = Math.hypot(dx, dy)
  if (eyeDistance < 1) throw new Error('両目の間隔が近すぎて位置合わせできません')

  const scale = (rw * EYE_SPAN) / eyeDistance
  const eyeCenterX = (left.x + right.x) / 2
  const eyeCenterY = (left.y + right.y) / 2

  // 写真は一度別のcanvasに描いてから外周をぼかす。
  // 顔テクスチャは頭の正面だけでなく斜め前の面にも回り込むため、
  // 切り抜かないと写真の背景や耳が頭の側面に貼り付いてしまう。
  const cut = document.createElement('canvas')
  cut.width = rw
  cut.height = rh
  const cutCtx = cut.getContext('2d')

  // 大きく縮小するのでこの描画だけ平滑化を有効にする（ジャギーを抑える）
  cutCtx.imageSmoothingEnabled = true
  cutCtx.imageSmoothingQuality = 'high'

  cutCtx.translate(rw * 0.5, rh * EYE_LINE)
  cutCtx.rotate(-angle)
  cutCtx.scale(scale, scale)
  cutCtx.translate(-eyeCenterX, -eyeCenterY)
  cutCtx.drawImage(source, 0, 0)
  cutCtx.setTransform(1, 0, 0, 1, 0, 0)

  featherToOval(cutCtx, rw, rh)

  const { ctx } = atlas
  ctx.fillStyle = atlas.colors.skin
  ctx.fillRect(rx, ry, rw, rh)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(cut, rx, ry)

  quantize15bit(ctx, region('face'))
  atlas.commit()
}

/**
 * 切り出し済みの画像を、位置合わせなしで顔領域へ貼る。
 * 利用者が矩形で範囲を選んだ場合に使う。
 *
 * 外周を楕円状に溶かすのは自動の場合と同じ。顔テクスチャは頭の正面だけでなく
 * 斜め前の面にも回り込むため、切り抜かないと画像の縁が頭の側面に貼り付く。
 */
export function paintFaceCrop(atlas, image) {
  const [rx, ry, rw, rh] = region('face')

  const cut = document.createElement('canvas')
  cut.width = rw
  cut.height = rh
  const cutCtx = cut.getContext('2d')
  cutCtx.imageSmoothingEnabled = true
  cutCtx.imageSmoothingQuality = 'high'

  // 縦横比を保ったまま領域を埋める（はみ出す側を切る）
  const scale = Math.max(rw / image.width, rh / image.height)
  const drawW = image.width * scale
  const drawH = image.height * scale
  cutCtx.drawImage(image, (rw - drawW) / 2, (rh - drawH) / 2, drawW, drawH)

  featherToOval(cutCtx, rw, rh)

  const { ctx } = atlas
  ctx.fillStyle = atlas.colors.skin
  ctx.fillRect(rx, ry, rw, rh)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(cut, rx, ry)

  quantize15bit(ctx, region('face'))
  atlas.commit()
}

/**
 * 楕円状に外周を透明へ落とす。
 * 顔の中心は写真のまま残し、輪郭の外側だけを下地の肌色へ溶かす。
 */
function featherToOval(ctx, width, height) {
  const cx = width * 0.5
  const cy = height * (EYE_LINE + 0.08)
  const radius = width * 0.5

  ctx.save()
  // 縦長の楕円にする
  ctx.translate(cx, cy)
  ctx.scale(1, 1.18)
  ctx.translate(-cx, -cy)

  const mask = ctx.createRadialGradient(cx, cy, radius * 0.62, cx, cy, radius)
  mask.addColorStop(0, 'rgba(0, 0, 0, 1)')
  mask.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = mask
  // scaleした分だけ塗り範囲も広げる
  ctx.fillRect(-width, -height, width * 3, height * 3)
  ctx.restore()
}

/**
 * 写真から肌の色を拾う。
 *
 * 顔テクスチャの周りにはパレットの肌色が敷かれる。そこが写真の肌と合っていないと、
 * 顔の輪郭に色の違う縁が出る。写真側から拾って下地に使うことでそれを消す。
 *
 * 検出結果があれば目の下（頬から鼻にかけて）を、なければ画像の中央を見る。
 * 平均ではなく中央値を採るのは、髪や影が混ざったときに引っ張られないため。
 */
export function sampleSkinTone(image, detection) {
  const width = image.width ?? image.naturalWidth
  const height = image.height ?? image.naturalHeight

  let cx = width * 0.5
  let cy = height * 0.5
  let size = Math.min(width, height) * 0.25

  if (detection?.eyes) {
    const [left, right] = detection.eyes
    const span = Math.hypot(right.x - left.x, right.y - left.y)
    cx = (left.x + right.x) / 2
    cy = (left.y + right.y) / 2 + span * 0.75
    size = span * 0.7
  }

  const half = Math.max(2, Math.round(size / 2))
  const sx = Math.max(0, Math.min(width - half * 2, Math.round(cx - half)))
  const sy = Math.max(0, Math.min(height - half * 2, Math.round(cy - half)))

  const patch = document.createElement('canvas')
  patch.width = half * 2
  patch.height = half * 2
  const ctx = patch.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, sx, sy, patch.width, patch.height, 0, 0, patch.width, patch.height)

  const { data } = ctx.getImageData(0, 0, patch.width, patch.height)
  const channels = [[], [], []]
  for (let i = 0; i < data.length; i += 4) {
    channels[0].push(data[i])
    channels[1].push(data[i + 1])
    channels[2].push(data[i + 2])
  }
  const median = (values) => {
    values.sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }
  return channels.map(median)
}

/** RGBを暗くしたhex。影側の色に使う。 */
export function shadeOf(rgb, amount = 0.82) {
  const hex = rgb
    .map((value) => Math.round(Math.max(0, Math.min(255, value * amount))).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

/** 写真を外したときに仮の顔へ戻す。 */
export function clearFace(atlas) {
  drawPlaceholderFace(atlas)
  quantize15bit(atlas.ctx, region('face'))
  atlas.commit()
}

/** ファイルをデコードする。EXIFの回転はcreateImageBitmapに任せる。 */
export async function decodeImage(file) {
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

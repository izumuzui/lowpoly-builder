/**
 * 人物セグメンテーションと姿勢点から、既存の画像スロットへ貼れる部位画像を作る。
 * モデルの6分類は服を上下に分けないため、Pose Landmarkerの腰・膝・足首で分割する。
 */
import {
  MEDIAPIPE_VISION_MODULE,
  MEDIAPIPE_WASM_BASE,
  SELFIE_MULTICLASS_MODEL,
} from './config.js?v=20260804-12'

const CATEGORY = {
  background: 0,
  hair: 1,
  bodySkin: 2,
  faceSkin: 3,
  clothes: 4,
  other: 5,
}

const LANDMARK = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftFoot: 31,
  rightFoot: 32,
}

const MAX_WORK_SIZE = 768
const MIN_PART_RATIO = 0.0008

let worker = null
let requestSequence = 0
const requests = new Map()

/** 推論専用Workerを使い回す。写真はImageBitmapとして渡し、サーバーへは送らない。 */
export async function segmentPerson(image) {
  const bitmap = await createImageBitmap(image)
  const id = ++requestSequence
  return new Promise((resolve, reject) => {
    requests.set(id, { resolve, reject })
    const target = segmentationWorker()
    try {
      target.postMessage({
        id,
        image: bitmap,
        options: {
          visionBundle: MEDIAPIPE_VISION_MODULE.replace('vision_bundle.mjs', 'vision_bundle.js'),
          wasmBase: MEDIAPIPE_WASM_BASE,
          modelPath: SELFIE_MULTICLASS_MODEL,
        },
      }, [bitmap])
    } catch (error) {
      requests.delete(id)
      bitmap.close?.()
      reject(error)
    }
  })
}

function segmentationWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./auto-texture-worker.js?v=20260804-12', import.meta.url))
  worker.addEventListener('message', (event) => {
    const request = requests.get(event.data.id)
    if (!request) return
    requests.delete(event.data.id)
    if (event.data.ok) {
      request.resolve({
        width: event.data.width,
        height: event.data.height,
        categories: event.data.categories,
        labels: event.data.labels ?? [],
      })
    } else {
      request.reject(new Error(event.data.error))
    }
  })
  worker.addEventListener('error', (event) => {
    const error = new Error(event.message || 'セグメンテーション処理を開始できませんでした')
    for (const request of requests.values()) request.reject(error)
    requests.clear()
    worker?.terminate()
    worker = null
  })
  return worker
}

/**
 * セグメンテーション結果を、顔・髪・上着・下半身・靴の透明canvasへ分ける。
 * @returns {{facing:'front'|'back', parts:object, personBounds:object}}
 */
export function createAutomaticTextureParts(image, segmentation, {
  poseDetection = null,
  faceDetection = null,
} = {}) {
  const sourceWidth = image.width ?? image.naturalWidth
  const sourceHeight = image.height ?? image.naturalHeight
  const workScale = Math.min(1, MAX_WORK_SIZE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * workScale))
  const height = Math.max(1, Math.round(sourceHeight * workScale))
  const base = document.createElement('canvas')
  base.width = width
  base.height = height
  const baseCtx = base.getContext('2d', { willReadFrequently: true })
  baseCtx.imageSmoothingEnabled = true
  baseCtx.imageSmoothingQuality = 'high'
  baseCtx.drawImage(image, 0, 0, width, height)
  const pixels = baseCtx.getImageData(0, 0, width, height)

  const categoryPlane = scaleCategoryMask(segmentation, width, height)
  const personBounds = categoryBounds(categoryPlane, width, height)
  if (!personBounds) throw new Error('人物の領域を検出できませんでした')

  const anchors = bodyAnchors(poseDetection?.landmarks, personBounds)
  const resolvedFaceDetection = resolveAutomaticFaceDetection({
    faceDetection,
    poseLandmarks: poseDetection?.landmarks,
    segmentation,
    sourceWidth,
    sourceHeight,
    personBounds,
  })
  const facing = resolvedFaceDetection ? 'front' : 'back'
  // 小物(others)を混ぜると、手や動画UIまで服へ誤転写されやすい。
  // 上下の服はclothesだけに絞り、靴だけ小物カテゴリも許可する。
  const clothes = (category) => category === CATEGORY.clothes
  const footwear = (category) => category === CATEGORY.clothes || category === CATEGORY.other
  const personWidth = personBounds.right - personBounds.left
  const personHeight = personBounds.bottom - personBounds.top
  const xMargin = personWidth * 0.08

  const definitions = {
    hair: (category, x, y) =>
      category === CATEGORY.hair
      && x >= personBounds.left - xMargin
      && x <= personBounds.right + xMargin
      && y <= anchors.shoulderY + personHeight * 0.04,
    shirt: (category, x, y) =>
      clothes(category)
      && inTorsoArea(x, anchors, personWidth)
      && !inArmArea(x, y, anchors, personWidth)
      && y >= anchors.headBottom
      && y <= anchors.hipY + personHeight * 0.035,
    pants: (category, x, y) =>
      clothes(category)
      && inLegArea(x, y, anchors, personWidth)
      && !inArmArea(x, y, anchors, personWidth)
      && y >= anchors.hipY - personHeight * 0.025
      && y <= anchors.ankleY - personHeight * 0.015,
    shoes: (category, x, y) =>
      footwear(category) && inFootArea(x, y, anchors, personWidth, personHeight),
  }

  const parts = {}
  for (const [name, predicate] of Object.entries(definitions)) {
    const part = maskedPart(pixels, categoryPlane, width, height, predicate, sourceWidth, sourceHeight)
    if (part) parts[name] = part
  }

  // 顔は検出した目を基準に貼るため、切り詰めず元画像と同じ比率のcanvasを使う。
  if (facing === 'front' && resolvedFaceDetection) {
    const facePredicate = (category, x, y) =>
      (category === CATEGORY.hair
        || category === CATEGORY.bodySkin
        || category === CATEGORY.faceSkin)
      && inHeadArea(x, y, resolvedFaceDetection, sourceWidth, sourceHeight, personBounds)
    const face = maskedPart(
      pixels,
      categoryPlane,
      width,
      height,
      facePredicate,
      sourceWidth,
      sourceHeight,
      { crop: false },
    )
    if (face) {
      face.sourceDetection = resolvedFaceDetection
      face.detection = scaleFaceDetection(
        resolvedFaceDetection,
        width / sourceWidth,
        height / sourceHeight,
      )
      parts.face = face
    }
  }

  return { facing, parts, personBounds }
}

function scaleCategoryMask(segmentation, width, height) {
  const output = new Uint8Array(width * height)
  const { categories, width: maskWidth, height: maskHeight } = segmentation
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(maskHeight - 1, Math.floor((y + 0.5) * maskHeight / height))
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(maskWidth - 1, Math.floor((x + 0.5) * maskWidth / width))
      output[y * width + x] = categories[sourceY * maskWidth + sourceX]
    }
  }
  return output
}

function categoryBounds(categories, width, height) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (categories[y * width + x] === CATEGORY.background) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) return null
  return {
    left: left / width,
    top: top / height,
    right: (right + 1) / width,
    bottom: (bottom + 1) / height,
  }
}

function bodyAnchors(landmarks, bounds) {
  const visible = (index) => {
    const point = landmarks?.[index]
    return point && Math.min(point.visibility ?? 1, point.presence ?? 1) >= 0.35
      ? point
      : null
  }
  const averageY = (a, b, fallback) => {
    const left = visible(a)
    const right = visible(b)
    if (left && right) return (left.y + right.y) / 2
    return left?.y ?? right?.y ?? fallback
  }
  const height = bounds.bottom - bounds.top
  const shoulderY = averageY(
    LANDMARK.leftShoulder,
    LANDMARK.rightShoulder,
    bounds.top + height * 0.24,
  )
  const hipY = averageY(LANDMARK.leftHip, LANDMARK.rightHip, bounds.top + height * 0.53)
  const kneeY = averageY(LANDMARK.leftKnee, LANDMARK.rightKnee, bounds.top + height * 0.75)
  const ankleY = averageY(LANDMARK.leftAnkle, LANDMARK.rightAnkle, bounds.top + height * 0.91)
  const feet = [
    footAnchor(visible(LANDMARK.leftAnkle), visible(LANDMARK.leftFoot)),
    footAnchor(visible(LANDMARK.rightAnkle), visible(LANDMARK.rightFoot)),
  ].filter(Boolean)
  const torsoPoints = [
    visible(LANDMARK.leftShoulder),
    visible(LANDMARK.rightShoulder),
    visible(LANDMARK.leftHip),
    visible(LANDMARK.rightHip),
  ].filter(Boolean)
  const legSegments = [
    [visible(LANDMARK.leftHip), visible(LANDMARK.leftKnee)],
    [visible(LANDMARK.leftKnee), visible(LANDMARK.leftAnkle)],
    [visible(LANDMARK.rightHip), visible(LANDMARK.rightKnee)],
    [visible(LANDMARK.rightKnee), visible(LANDMARK.rightAnkle)],
  ].filter(([start, end]) => start && end)
  const armSegments = [
    [visible(LANDMARK.leftShoulder), visible(LANDMARK.leftElbow)],
    [visible(LANDMARK.leftElbow), visible(LANDMARK.leftWrist)],
    [visible(LANDMARK.rightShoulder), visible(LANDMARK.rightElbow)],
    [visible(LANDMARK.rightElbow), visible(LANDMARK.rightWrist)],
  ].filter(([start, end]) => start && end)
  return {
    shoulderY,
    hipY: Math.max(shoulderY + height * 0.08, hipY),
    kneeY,
    ankleY: Math.max(kneeY + height * 0.06, ankleY),
    headBottom: shoulderY - height * 0.045,
    feet,
    torsoPoints,
    legSegments,
    armSegments,
    bounds,
  }
}

function footAnchor(ankle, toe) {
  if (!ankle && !toe) return null
  if (!ankle) return { x: toe.x, y: toe.y }
  if (!toe) return { x: ankle.x, y: ankle.y }
  return { x: (ankle.x + toe.x) / 2, y: (ankle.y + toe.y) / 2 }
}

/**
 * 顔専用検出が取れなくても、姿勢の両目、最後に顔カテゴリのマスクから貼り付け位置を補う。
 * 返す座標はすべて元画像のピクセル座標。
 */
export function resolveAutomaticFaceDetection({
  faceDetection = null,
  poseLandmarks = null,
  segmentation = null,
  sourceWidth,
  sourceHeight,
  personBounds = null,
}) {
  if (validFaceDetection(faceDetection)) return faceDetection
  return faceDetectionFromPose(poseLandmarks, sourceWidth, sourceHeight)
    ?? faceDetectionFromMask(segmentation, sourceWidth, sourceHeight, personBounds)
}

function validFaceDetection(detection) {
  return detection?.eyes?.length >= 2
    && detection.eyes.every((eye) => Number.isFinite(eye.x) && Number.isFinite(eye.y))
}

function faceDetectionFromPose(landmarks, sourceWidth, sourceHeight) {
  const visible = (index) => {
    const point = landmarks?.[index]
    return point && Math.min(point.visibility ?? 1, point.presence ?? 1) >= 0.35
      ? point
      : null
  }
  const eyes = [visible(LANDMARK.leftEye), visible(LANDMARK.rightEye)]
  if (eyes.some((eye) => !eye)) return null

  const pixelEyes = eyes
    .map((eye) => ({ x: eye.x * sourceWidth, y: eye.y * sourceHeight }))
    .sort((a, b) => a.x - b.x)
  const [left, right] = pixelEyes
  const eyeSpan = Math.hypot(right.x - left.x, right.y - left.y)
  const minimumSpan = Math.max(1, Math.min(sourceWidth, sourceHeight) * 0.002)
  if (!Number.isFinite(eyeSpan) || eyeSpan < minimumSpan) return null

  const centerX = (left.x + right.x) / 2
  const centerY = (left.y + right.y) / 2
  const box = clippedBox(
    centerX - eyeSpan * 1.35,
    centerY - eyeSpan * 0.95,
    eyeSpan * 2.7,
    eyeSpan * 3.2,
    sourceWidth,
    sourceHeight,
  )
  return box ? { eyes: pixelEyes, box } : null
}

function faceDetectionFromMask(segmentation, sourceWidth, sourceHeight, personBounds) {
  const maskWidth = segmentation?.width
  const maskHeight = segmentation?.height
  const categories = segmentation?.categories
  if (!maskWidth || !maskHeight || categories?.length < maskWidth * maskHeight) return null

  const personTop = personBounds?.top ?? 0
  const personHeight = (personBounds?.bottom ?? 1) - personTop
  const headLimit = personTop + personHeight * 0.32
  let left = maskWidth
  let top = maskHeight
  let right = -1
  let bottom = -1
  let count = 0
  for (let y = 0; y < maskHeight; y += 1) {
    const normalizedY = (y + 0.5) / maskHeight
    if (normalizedY > headLimit) break
    for (let x = 0; x < maskWidth; x += 1) {
      if (categories[y * maskWidth + x] !== CATEGORY.faceSkin) continue
      count += 1
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  const minimumPixels = Math.max(8, Math.round(maskWidth * maskHeight * 0.00003))
  if (count < minimumPixels || right < left || bottom < top) return null

  const faceLeft = left * sourceWidth / maskWidth
  const faceTop = top * sourceHeight / maskHeight
  const faceWidth = (right - left + 1) * sourceWidth / maskWidth
  const faceHeight = (bottom - top + 1) * sourceHeight / maskHeight
  if (faceWidth < Math.max(2, sourceWidth * 0.005)
    || faceHeight < Math.max(3, sourceHeight * 0.005)) return null

  const eyeY = faceTop + faceHeight * 0.38
  const eyes = [
    { x: faceLeft + faceWidth * 0.32, y: eyeY },
    { x: faceLeft + faceWidth * 0.68, y: eyeY },
  ]
  const box = clippedBox(
    faceLeft - faceWidth * 0.12,
    faceTop - faceHeight * 0.08,
    faceWidth * 1.24,
    faceHeight * 1.18,
    sourceWidth,
    sourceHeight,
  )
  return box ? { eyes, box } : null
}

function clippedBox(x, y, width, height, sourceWidth, sourceHeight) {
  const left = Math.max(0, x)
  const top = Math.max(0, y)
  const right = Math.min(sourceWidth, x + width)
  const bottom = Math.min(sourceHeight, y + height)
  if (![left, top, right, bottom].every(Number.isFinite)
    || right - left < 2
    || bottom - top < 2) return null
  return { originX: left, originY: top, width: right - left, height: bottom - top }
}

function inTorsoArea(x, anchors, personWidth) {
  if (!anchors.torsoPoints.length) {
    return x >= anchors.bounds.left && x <= anchors.bounds.right
  }
  const xs = anchors.torsoPoints.map((point) => point.x)
  const margin = personWidth * 0.08
  return x >= Math.min(...xs) - margin && x <= Math.max(...xs) + margin
}

function inLegArea(x, y, anchors, personWidth) {
  if (!anchors.legSegments.length) return true
  const radius = Math.max(personWidth * 0.13, 0.027)
  return anchors.legSegments.some(([start, end]) =>
    distanceToSegment(x, y, start.x, start.y, end.x, end.y) <= radius,
  )
}

function inArmArea(x, y, anchors, personWidth) {
  if (!anchors.armSegments.length) return false
  const radius = Math.max(personWidth * 0.105, 0.022)
  return anchors.armSegments.some(([start, end]) =>
    distanceToSegment(x, y, start.x, start.y, end.x, end.y) <= radius,
  )
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  if (lengthSq < 1e-8) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

function inFootArea(x, y, anchors, personWidth, personHeight) {
  const radiusX = Math.max(personWidth * 0.16, 0.035)
  const radiusY = Math.max(personHeight * 0.075, 0.035)
  if (anchors.feet.length) {
    return anchors.feet.some((foot) =>
      ((x - foot.x) / radiusX) ** 2 + ((y - foot.y) / radiusY) ** 2 <= 1,
    )
  }
  return y >= anchors.ankleY - personHeight * 0.045
    && y <= anchors.bounds.bottom + personHeight * 0.025
}

function inHeadArea(x, y, detection, sourceWidth, sourceHeight, personBounds) {
  const box = detection.box
  if (!box) {
    return y <= personBounds.top + (personBounds.bottom - personBounds.top) * 0.25
  }
  const left = Math.max(0, (box.originX - box.width * 0.28) / sourceWidth)
  const right = Math.min(1, (box.originX + box.width * 1.28) / sourceWidth)
  const top = Math.max(0, (box.originY - box.height * 0.42) / sourceHeight)
  const bottom = Math.min(1, (box.originY + box.height * 1.16) / sourceHeight)
  return x >= left && x <= right && y >= top && y <= bottom
}

function maskedPart(
  sourcePixels,
  categories,
  width,
  height,
  predicate,
  sourceWidth,
  sourceHeight,
  { crop = true } = {},
) {
  const data = new Uint8ClampedArray(sourcePixels.data)
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  let count = 0

  for (let y = 0; y < height; y += 1) {
    const ny = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const offset = index * 4
      const keep = predicate(
        categories[index],
        (x + 0.5) / width,
        ny,
        data[offset],
        data[offset + 1],
        data[offset + 2],
      )
      if (!keep) {
        data[offset + 3] = 0
        continue
      }
      count += 1
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (count < width * height * MIN_PART_RATIO || right < left || bottom < top) return null
  const full = document.createElement('canvas')
  full.width = width
  full.height = height
  full.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0)

  if (!crop) {
    return {
      canvas: full,
      selection: { mode: 'auto' },
      sourceRect: { x: 0, y: 0, w: sourceWidth, h: sourceHeight },
      pixelCount: count,
    }
  }

  const margin = Math.max(2, Math.round(Math.max(right - left, bottom - top) * 0.035))
  left = Math.max(0, left - margin)
  top = Math.max(0, top - margin)
  right = Math.min(width - 1, right + margin)
  bottom = Math.min(height - 1, bottom + margin)
  const cropWidth = right - left + 1
  const cropHeight = bottom - top + 1
  const canvas = document.createElement('canvas')
  canvas.width = cropWidth
  canvas.height = cropHeight
  canvas.getContext('2d').drawImage(full, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  const sourceRect = {
    x: left * sourceWidth / width,
    y: top * sourceHeight / height,
    w: cropWidth * sourceWidth / width,
    h: cropHeight * sourceHeight / height,
  }
  return {
    canvas,
    selection: { mode: 'rect', rect: sourceRect, rectSpace: 'image' },
    sourceRect,
    pixelCount: count,
  }
}

function scaleFaceDetection(detection, scaleX, scaleY) {
  return {
    eyes: detection.eyes.map((eye) => ({ x: eye.x * scaleX, y: eye.y * scaleY })),
    box: detection.box
      ? {
          originX: detection.box.originX * scaleX,
          originY: detection.box.originY * scaleY,
          width: detection.box.width * scaleX,
          height: detection.box.height * scaleY,
        }
      : null,
  }
}

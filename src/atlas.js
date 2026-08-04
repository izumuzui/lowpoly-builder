/**
 * UVアトラス。1キャラクター1枚のテクスチャに全パーツを詰める（PS1期の実機構成に倣う）。
 */
import * as THREE from 'three'

/**
 * アトラスの基準サイズ。領域の座標はすべてこの256pxのグリッドで定義し、
 * 実際の解像度は倍率を掛けて決める。
 *
 * 実写を貼る場合、64×96pxの胴では情報が足りない。一方でPS1らしさは
 * 低解像度から来ているため、倍率は利用者が選べるようにしてある。
 */
export const BASE_SIZE = 256

let scale = 1

export function setAtlasScale(next) {
  scale = next
}

export function atlasSize() {
  return BASE_SIZE * scale
}

/** 倍率を掛けた領域の矩形。描画にはこちらを使う。 */
export function region(name) {
  const rect = REGIONS[name]
  if (!rect) throw new Error(`未定義のアトラス領域: ${name}`)
  return rect.map((value) => value * scale)
}

/** 領域名 → [x, y, w, h]（基準グリッド上の座標。yは上が0） */
export const REGIONS = {
  face: [0, 0, 128, 128],
  headBack: [128, 0, 64, 64],
  headSide: [192, 0, 64, 64],
  headTop: [128, 64, 64, 64],
  headBottom: [192, 64, 64, 64],
  torsoFront: [0, 128, 64, 96],
  torsoBack: [64, 128, 64, 96],
  torsoSide: [128, 128, 32, 96],
  sleeve: [160, 128, 32, 96],
  skin: [192, 128, 32, 96],
  // 脚の正面写真は左右で分ける。legs はスカート用に両方を束ねた互換領域。
  legs: [224, 128, 32, 96],
  legLeftFront: [224, 128, 16, 96],
  legRightFront: [240, 128, 16, 96],
  legSide: [64, 224, 16, 32],
  legBack: [80, 224, 16, 32],
  // shoe は互換領域。通常の足は左右別の正面と、無地の側面・背面を使う。
  shoe: [0, 224, 64, 32],
  shoeLeftFront: [0, 224, 32, 32],
  shoeRightFront: [32, 224, 32, 32],
  shoeSide: [96, 224, 32, 32],
  shoeBack: [128, 224, 32, 32],
}

/** uvSet名 → 箱の6面がどの領域を使うか。px=+X面, nz=-Z面 のように表す。 */
export const UV_SETS = {
  head: {
    pz: 'face',
    nz: 'headBack',
    px: 'headSide',
    nx: 'headSide',
    py: 'headTop',
    ny: 'headBottom',
  },
  torso: {
    pz: 'torsoFront',
    nz: 'torsoBack',
    px: 'torsoSide',
    nx: 'torsoSide',
    py: 'torsoSide',
    ny: 'torsoSide',
  },
  skin: fill('skin'),
  sleeve: fill('sleeve'),
  // 襟・フード・ポケットなど、同じ服の中で段差を読ませるための濃い面
  clothShade: fill('torsoSide'),
  legs: directional('legs', 'legBack', 'legSide'),
  legsLeft: directional('legLeftFront', 'legBack', 'legSide'),
  legsRight: directional('legRightFront', 'legBack', 'legSide'),
  shoe: directional('shoe', 'shoeBack', 'shoeSide'),
  shoeLeft: directional('shoeLeftFront', 'shoeBack', 'shoeSide'),
  shoeRight: directional('shoeRightFront', 'shoeBack', 'shoeSide'),
}

/**
 * 利用者が画像を差し替えられる枠。
 *
 * `regions` の先頭が正面。生地として敷くときは全領域に、
 * 形として貼る（フリーハンド）ときは正面だけに使う。
 * ロゴが袖や背中にも出てしまうのを避けるため。
 */
export const TEXTURE_SLOTS = {
  shirt: { label: '服', regions: ['torsoFront', 'torsoBack', 'torsoSide', 'sleeve'] },
  pants: {
    label: 'ズボン',
    regions: ['legLeftFront', 'legRightFront', 'legSide', 'legBack'],
  },
  shoes: {
    label: '靴',
    regions: ['shoeLeftFront', 'shoeRightFront', 'shoeSide', 'shoeBack'],
  },
  // 背面・側面の写真を流し込む枠。服より後に塗って上書きする
  shirtBack: { label: '服（背面）', regions: ['torsoBack'] },
  hair: { label: '髪・後頭部', regions: ['headBack', 'headSide', 'headTop'] },
}

function fill(name) {
  return { pz: name, nz: name, px: name, nx: name, py: name, ny: name }
}

/** 正面だけ写真を使い、それ以外は側面・背面の地色へ逃がす。 */
function directional(front, back, side) {
  return { pz: front, nz: back, px: side, nx: side, py: side, ny: side }
}

/**
 * 顔の位置合わせ基準。face.js の写真転写と drawPlaceholderFace の両方がこれを使う。
 * eyeSpan は顔領域の幅に対する両目間の距離、eyeLine は高さに対する両目の位置。
 * eyeSpan を小さくすると顔全体が小さくなり、eyeLine を小さくすると顎側の余白が増える。
 */
export const FACE_ANCHOR = { eyeSpan: 0.4, eyeLine: 0.42 }

export const DEFAULT_PALETTE = {
  skin: '#c99b76',
  skinShade: '#a97e5d',
  hair: '#3a2b22',
  cloth: '#4d5a6b',
  clothShade: '#3b4553',
  legs: '#3e4756',
  shoe: '#26292f',
  feature: '#2b211c',
}

/** 各領域の下地に使うパレットの色。画像を外したときもここへ戻す。 */
const REGION_BASE = {
  headBack: 'hair',
  headSide: 'hair',
  headTop: 'hair',
  headBottom: 'skinShade',
  torsoFront: 'cloth',
  torsoBack: 'clothShade',
  torsoSide: 'clothShade',
  skin: 'skin',
  sleeve: 'cloth',
  legs: 'legs',
  legLeftFront: 'legs',
  legRightFront: 'legs',
  legSide: 'legs',
  legBack: 'legs',
  shoe: 'shoe',
  shoeLeftFront: 'shoe',
  shoeRightFront: 'shoe',
  shoeSide: 'shoe',
  shoeBack: 'shoe',
}

/**
 * 領域をUV矩形に変換する。
 * CanvasTextureはflipY=trueのため、canvasの上端がv=1に対応する。
 * 隣接領域の滲みを避けて半ピクセル内側に寄せる。
 */
export function uvRect(regionName) {
  const [x, y, w, h] = region(regionName)
  const size = atlasSize()
  const inset = 0.5
  return {
    u0: (x + inset) / size,
    u1: (x + w - inset) / size,
    v0: 1 - (y + h - inset) / size,
    v1: 1 - (y + inset) / size,
  }
}

/**
 * ベーステクスチャを描いたアトラスを作る。
 * 顔領域には写真が入るまでの仮の顔を描いておく。
 */
export function createAtlas(palette = {}) {
  const colors = { ...DEFAULT_PALETTE, ...palette }

  const canvas = document.createElement('canvas')
  canvas.width = atlasSize()
  canvas.height = atlasSize()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = false

  const paint = (name, color) => {
    const [x, y, w, h] = region(name)
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }

  ctx.fillStyle = colors.skin
  ctx.fillRect(0, 0, atlasSize(), atlasSize())

  for (const [regionName, colorKey] of Object.entries(REGION_BASE)) {
    paint(regionName, colors[colorKey])
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 1

  const atlas = {
    canvas,
    ctx,
    texture,
    colors,
    /** 顔領域を再描画したあとに呼ぶ。 */
    commit() {
      texture.needsUpdate = true
    },
  }

  drawPlaceholderFace(atlas)
  quantize15bit(ctx)
  atlas.commit()

  return atlas
}

/**
 * 写真が入るまでの仮の顔。
 * 目と口の位置は FACE_ANCHOR に揃えてあり、写真に差し替わっても顔の重心が動かない。
 */
export function drawPlaceholderFace(atlas) {
  const { ctx, colors } = atlas
  const [x, y, w, h] = region('face')

  ctx.fillStyle = colors.skin
  ctx.fillRect(x, y, w, h)

  const eyeGap = w * FACE_ANCHOR.eyeSpan
  const eyeY = y + h * FACE_ANCHOR.eyeLine
  const centerX = x + w * 0.5
  const eyeW = Math.round(w * 0.13)
  const eyeH = Math.round(h * 0.06)

  ctx.fillStyle = colors.feature
  ctx.fillRect(Math.round(centerX - eyeGap / 2 - eyeW / 2), Math.round(eyeY - eyeH / 2), eyeW, eyeH)
  ctx.fillRect(Math.round(centerX + eyeGap / 2 - eyeW / 2), Math.round(eyeY - eyeH / 2), eyeW, eyeH)

  const mouthW = Math.round(w * 0.22)
  ctx.fillRect(Math.round(centerX - mouthW / 2), Math.round(y + h * 0.68), mouthW, Math.max(2, Math.round(h * 0.03)))
}

/**
 * 領域ごとに、元画像のどこを使うかの窓（画像に対する比率で [x, y, w, h]）。
 *
 * 1枚の写真を全領域に同じように貼ると、袖のような縦長の領域には
 * 写真の中央が縦一本に切り出される。胸元の写真ならそこはネクタイであり、
 * 肩にネクタイの柄が出てしまう。
 *
 * 正面写真では腕は左右の端に写っているので、袖と側面には端を使う。
 */
const SOURCE_WINDOW = {
  torsoFront: [0.16, 0, 0.68, 1],
  torsoBack: [0.16, 0, 0.68, 1],
  torsoSide: [0, 0, 0.16, 1],
  sleeve: [0, 0, 0.16, 1],
  legLeftFront: [0, 0, 0.5, 1],
  legRightFront: [0.5, 0, 0.5, 1],
  shoeLeftFront: [0, 0, 0.5, 1],
  shoeRightFront: [0.5, 0, 0.5, 1],
  headBack: [0.18, 0, 0.64, 1],
  headSide: [0, 0, 0.18, 1],
  headTop: [0.18, 0, 0.64, 0.35],
}

const FULL_WINDOW = [0, 0, 1, 1]

/**
 * 枠（服・ズボン・靴）に画像を貼る。
 *
 * fit の意味:
 * - `cover`   … 縦横比を保ったまま領域を埋める。はみ出す側を切る。生地・柄向き
 * - `contain` … 縦横比を保ったまま領域に収める。余白は下地の色。ロゴ・ワッペン向き
 *
 * どちらの場合も先に下地を塗る。フリーハンドで切り出した画像は形の外が透明なので、
 * 下地がないと背後の描画が透けてしまう。
 */
export function paintSlot(atlas, slotId, image, { fit = 'cover', regionImages = null } = {}) {
  const slot = TEXTURE_SLOTS[slotId]
  if (!slot) throw new Error(`未定義のテクスチャ枠: ${slotId}`)

  const { ctx } = atlas
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 形として貼る場合は正面だけ。生地として敷く場合は全領域
  const targets = fit === 'contain' ? slot.regions.slice(0, 1) : slot.regions

  for (const regionName of targets) {
    const rect = region(regionName)
    const [x, y, w, h] = rect
    const regionImage = regionImages?.[regionName] ?? image
    const hasRegionImage = Boolean(regionImages?.[regionName])
    // 形として貼る場合は画像全体を使う。切り抜いた形を欠けさせないため
    const window = fit === 'contain' || hasRegionImage
      ? FULL_WINDOW
      : (SOURCE_WINDOW[regionName] ?? FULL_WINDOW)
    ctx.fillStyle = atlas.colors[REGION_BASE[regionName]]
    ctx.fillRect(x, y, w, h)
    drawFitted(ctx, regionImage, x, y, w, h, fit, window)
    quantize15bit(ctx, rect)
  }

  ctx.imageSmoothingEnabled = false
  atlas.commit()
}

/** 元画像の窓を切り出し、縦横比を保って矩形に収める／埋める。 */
function drawFitted(ctx, image, x, y, w, h, fit, window = FULL_WINDOW) {
  const sx = image.width * window[0]
  const sy = image.height * window[1]
  const sw = Math.max(1, image.width * window[2])
  const sh = Math.max(1, image.height * window[3])

  const scale = fit === 'contain' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh)
  const drawW = sw * scale
  const drawH = sh * scale
  const dx = x + (w - drawW) / 2
  const dy = y + (h - drawH) / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, drawW, drawH)
  ctx.restore()
}

/** 枠を下地の色へ戻す。 */
export function clearSlot(atlas, slotId) {
  const slot = TEXTURE_SLOTS[slotId]
  if (!slot) return

  const { ctx } = atlas
  for (const regionName of slot.regions) {
    const rect = region(regionName)
    const [x, y, w, h] = rect
    ctx.fillStyle = atlas.colors[REGION_BASE[regionName]]
    ctx.fillRect(x, y, w, h)
    quantize15bit(ctx, rect)
  }
  atlas.commit()
}

/**
 * 各チャンネルを5bit（32段階）に落とす。
 * 初代PlayStationのフレームバッファが15bitカラーだったのを再現する。
 */
export function quantize15bit(ctx, rect = [0, 0, atlasSize(), atlasSize()]) {
  const [x, y, w, h] = rect
  const image = ctx.getImageData(x, y, w, h)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] & 0xf8
    data[i + 1] = data[i + 1] & 0xf8
    data[i + 2] = data[i + 2] & 0xf8
  }
  ctx.putImageData(image, x, y)
}

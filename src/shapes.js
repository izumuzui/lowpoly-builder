/**
 * パーツ形状の生成。すべて非インデックスの三角形として出力するため、
 * computeVertexNormals() でそのまま面ごとのフラットな法線になる。
 *
 * 座標系はスケルトンと同じ（Y-up、キャラクターは+Zを向く、左手が+X）。
 */
import { UV_SETS, uvRect } from './atlas.js'

/** 箱の6面。外側から見て反時計回りになる順に4隅の符号を並べてある。 */
const BOX_FACES = {
  pz: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  nz: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
  px: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
  nx: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
  py: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
  ny: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
}

const AXES = ['x', 'y', 'z']

/* ---------- 箱 ---------- */

export function appendBox(part, dimensions, boneIndex, buffers) {
  const { half, center } = dimensions
  const taper = part.taper ?? [1, 1]
  const taperAxis = part.taperAxis ?? 'y'
  const uvSet = resolveUvSet(part.uvSet)

  for (const [faceKey, corners] of Object.entries(BOX_FACES)) {
    const { u0, u1, v0, v1 } = uvRect(uvSet[faceKey])
    const faceUv = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ]

    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      for (const corner of [a, b, c]) {
        const point = taperedCorner(corners[corner], half, center, taperAxis, taper)
        push(buffers, point, faceUv[corner], boneIndex)
      }
    }
  }
}

/**
 * テーパー付きの箱の頂点位置。
 * taperAxis の負側の端で taper[0]、正側の端で taper[1] の倍率を、残り2軸に掛ける。
 */
function taperedCorner(signs, half, center, taperAxis, taper) {
  const sign = { x: signs[0], y: signs[1], z: signs[2] }
  const scale = sign[taperAxis] > 0 ? taper[1] : taper[0]

  const point = {}
  for (const axis of AXES) {
    const extent = sign[axis] * half[axis] * (axis === taperAxis ? 1 : scale)
    point[axis] = center[axis] + extent
  }
  return point
}

/* ---------- 輪郭の積み上げ ---------- */

/**
 * 積み上げ軸ごとの断面の基底。
 *
 * 断面上の点は sin(θ)·a + cos(θ)·b で表す。θ=0 が b の向きになる。
 * a × b が積み上げ軸の逆向きになるよう組を選んであり、
 * これにより蓋の三角形の巻き順が軸によらず一定になる。
 *
 * profile の [t, scaleA, scaleB] は a と b の倍率に対応する。
 */
const RING_BASIS = {
  y: { a: 'x', b: 'z', capPos: 'py', capNeg: 'ny', aPos: 'px', aNeg: 'nx', bPos: 'pz', bNeg: 'nz' },
  x: { a: 'z', b: 'y', capPos: 'px', capNeg: 'nx', aPos: 'pz', aNeg: 'nz', bPos: 'py', bNeg: 'ny' },
  z: { a: 'y', b: 'x', capPos: 'pz', capNeg: 'nz', aPos: 'py', aNeg: 'ny', bPos: 'px', bNeg: 'nx' },
}

/**
 * 面の向きごとの平面投影。[軸, 符号] の形で u と v にどの軸を使うかを持つ。
 * キーは面の向きと一致するため、UV領域の引き当てと投影で同じキーを使える。
 */
const PROJECTION = {
  pz: { u: ['x', 1], v: ['y', 1] },
  nz: { u: ['x', -1], v: ['y', 1] },
  px: { u: ['z', -1], v: ['y', 1] },
  nx: { u: ['z', 1], v: ['y', 1] },
  py: { u: ['x', 1], v: ['z', -1] },
  ny: { u: ['x', 1], v: ['z', 1] },
}

/**
 * b 方向（頭なら正面）とみなす閾値。
 * 8角形なら±45°の面までが正面側になり、顔がそこまで回り込む。
 */
const FACING_THRESHOLD = 0.35

/** 細かさの段階。粗い順に並べる。 */
export const DETAIL_ORDER = ['low', 'normal', 'high', 'ultra']

/**
 * 段階ごとの分割の倍率。断面の角数とリングの数にそれぞれ掛かる。
 * 輪郭の形（profile）は変えないためシルエットは保たれる。
 *
 * ただし細かさの主眼は分割ではなく、段階ごとに**パーツそのものが増える**こと
 * （肩・耳・親指・指など）。パーツ側の detail フィールドで制御する。
 * 分割だけを上げても情報量は増えず、ただ重くなるだけになる。
 */
export const DETAIL_LEVELS = {
  low: { sides: 0.7, rings: 1 },
  normal: { sides: 1, rings: 1 },
  // 「細かい」はリングを増やさない。差はパーツの追加で出す
  high: { sides: 1.25, rings: 1 },
  ultra: { sides: 1.6, rings: 2 },
}

/** 隣り合うリングの間に中間のリングを1枚ずつ挟む。 */
function subdivideProfile(profile) {
  const out = [profile[0]]
  for (let i = 1; i < profile.length; i += 1) {
    const a = profile[i - 1]
    const b = profile[i]
    out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
    out.push(b)
  }
  return out
}

/** 顔の輪郭。[高さの位置, 幅の倍率, 奥行きの倍率] を顎先から頭頂へ。 */
export const DEFAULT_HEAD_PROFILE = [
  [0.0, 0.58, 0.66],
  [0.14, 0.82, 0.86],
  [0.34, 0.96, 0.97],
  [0.56, 1.0, 1.0],
  [0.78, 0.97, 0.98],
  [0.92, 0.86, 0.88],
  [1.0, 0.62, 0.66],
]

/**
 * 断面を積み重ねた多角柱。頭・胴・手足すべてをこれで作る。
 *
 * 断面は sides 角形で、面の1枚がちょうど b 方向（積み上げ軸がYなら+Z）を
 * 向くよう角度を半ステップずらしてある。頭ではこれにより顔の中心が安定し、
 * その左右の面へ顔テクスチャが回り込む。
 *
 * UVは面の向きに応じた平面投影。u と v に使う軸の長い方で正規化するため、
 * テクスチャ領域が正方形でもパーツが縦長なら比率が保たれる。
 */
export function appendRings(part, dimensions, boneIndex, buffers, detail = DETAIL_LEVELS.normal) {
  const { half, center } = dimensions
  const axis = part.axis ?? 'y'
  const basis = RING_BASIS[axis]
  if (!basis) throw new Error(`未定義のaxis: ${part.axis}`)

  const sides = Math.max(3, Math.round((part.sides ?? 8) * detail.sides))
  let profile = part.profile ?? DEFAULT_HEAD_PROFILE
  if (profile.length < 2) throw new Error('profileには2行以上必要です')
  for (let i = 1; i < detail.rings; i += 1) profile = subdivideProfile(profile)

  const uvSet = resolveUvSet(part.uvSet)
  const step = (Math.PI * 2) / sides
  const extent = half[axis] * 2
  const start = center[axis] - half[axis]

  const rings = profile.map(([t, scaleA, scaleB]) =>
    Array.from({ length: sides }, (_, i) => {
      // 頂点ではなく面が b 方向を向くよう半ステップずらす
      const theta = (i - 0.5) * step
      const point = { x: center.x, y: center.y, z: center.z }
      point[axis] = start + t * extent
      point[basis.a] += Math.sin(theta) * half[basis.a] * scaleA
      point[basis.b] += Math.cos(theta) * half[basis.b] * scaleB
      return point
    }),
  )

  // 側面の帯
  for (let r = 0; r < rings.length - 1; r += 1) {
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides
      const quad = [rings[r][i], rings[r][next], rings[r + 1][next], rings[r + 1][i]]
      const facing = classify(i * step, basis)
      const uvOf = makeProjector(facing, uvSet[facing], dimensions)
      emitQuad(buffers, quad, uvOf, boneIndex)
    }
  }

  // 両端の蓋
  const last = rings[rings.length - 1]
  const first = rings[0]
  const posCenter = capCenter(center, axis, last[0][axis])
  const negCenter = capCenter(center, axis, first[0][axis])
  const posUv = makeProjector(basis.capPos, uvSet[basis.capPos], dimensions)
  const negUv = makeProjector(basis.capNeg, uvSet[basis.capNeg], dimensions)

  for (let i = 0; i < sides; i += 1) {
    const next = (i + 1) % sides
    // 基底の組み方により、この巻き順は常に積み上げ軸の正方向を向く
    emitTriangle(buffers, [posCenter, last[i], last[next]], posUv, boneIndex)
    emitTriangle(buffers, [negCenter, first[next], first[i]], negUv, boneIndex)
  }
}

function capCenter(center, axis, value) {
  const point = { x: center.x, y: center.y, z: center.z }
  point[axis] = value
  return point
}

/** 断面上の角度から、その面がどちらを向いているか決める。 */
function classify(theta, basis) {
  const alongB = Math.cos(theta)
  if (alongB > FACING_THRESHOLD) return basis.bPos
  if (alongB < -FACING_THRESHOLD) return basis.bNeg
  return Math.sin(theta) > 0 ? basis.aPos : basis.aNeg
}

/**
 * 平面投影でUVを求める関数を作る。
 *
 * 基準にする範囲は uvCenter / uvHalf。既定はパーツ自身の大きさだが、
 * uvGroup を指定したパーツではグループ全体の範囲が入る。
 * こうしないと胴の3パーツがそれぞれ独立して同じ領域を貼り、
 * 服の画像が縦に3回繰り返されてしまう。
 */
function makeProjector(facing, regionName, dimensions) {
  const half = dimensions.uvHalf ?? dimensions.half
  const center = dimensions.uvCenter ?? dimensions.center
  const { u: [uAxis, uSign], v: [vAxis, vSign] } = PROJECTION[facing]
  // 長い方の軸で正規化して、対象の縦横比をUVに保つ
  const span = Math.max(half[uAxis], half[vAxis]) * 2
  const rect = uvRect(regionName)

  return (point) => {
    const u = 0.5 + (uSign * (point[uAxis] - center[uAxis])) / span
    const v = 0.5 + (vSign * (point[vAxis] - center[vAxis])) / span
    return [
      rect.u0 + clamp01(u) * (rect.u1 - rect.u0),
      rect.v0 + clamp01(v) * (rect.v1 - rect.v0),
    ]
  }
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/* ---------- 共通 ---------- */

function emitQuad(buffers, quad, uvOf, boneIndex) {
  for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
    for (const corner of [a, b, c]) {
      push(buffers, quad[corner], uvOf(quad[corner]), boneIndex)
    }
  }
}

function emitTriangle(buffers, points, uvOf, boneIndex) {
  for (const point of points) {
    push(buffers, point, uvOf(point), boneIndex)
  }
}

function push(buffers, point, uv, boneIndex) {
  buffers.position.push(point.x, point.y, point.z)
  buffers.uv.push(uv[0], uv[1])
  buffers.skinIndex.push(boneIndex, 0, 0, 0)
  buffers.skinWeight.push(1, 0, 0, 0)
}

function resolveUvSet(name) {
  const uvSet = UV_SETS[name ?? 'skin']
  if (!uvSet) throw new Error(`未定義のuvSet: ${name}`)
  return uvSet
}

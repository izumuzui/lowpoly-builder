/**
 * 体型スペック（JSON）から、リグ付きのローポリメッシュを組み立てる。
 *
 * 単位について: スペック内の size / offset / proportions はすべて
 * 「身長を1としたときの比率」で書く。メートルではない。
 * こうしておくと身長を変えても破綻せず、体型の追加が値のコピー修正だけで済む。
 *
 * スキニングは1頂点1ボーンの剛体ウェイト。関節が滑らかに曲がらずパキッと折れるが、
 * これはPS1期の実装そのものであり意図した挙動。
 *
 * 形状は part.shape で切り替える。頭だけは箱ではなく専用形状を使う
 * （最も見られる部位であり、箱のままだと輪郭が四角く見えるため）。
 */
import * as THREE from 'three'
import { createSkeleton, BONE_PREFIX } from './skeleton.js'
import { appendBox, appendRings, appendWedge, DETAIL_LEVELS, DETAIL_ORDER } from './shapes.js?v=20260805-16'

/** part.shape が指す形状の生成関数。既定は box。 */
const SHAPES = {
  box: appendBox,
  rings: appendRings,
  wedge: appendWedge,
}

/** 左パーツを複製した右パーツだけ、対応する写真領域へ切り替える。 */
const MIRRORED_UV_SETS = {
  legsLeft: 'legsRight',
  shoeLeft: 'shoeRight',
}

export async function loadBodyList(baseUrl = './bodies') {
  const response = await fetch(`${baseUrl}/index.json`)
  if (!response.ok) throw new Error(`体型一覧を読み込めませんでした (${response.status})`)
  return response.json()
}

export async function loadBodySpec(id, baseUrl = './bodies') {
  const response = await fetch(`${baseUrl}/${id}.json`)
  if (!response.ok) throw new Error(`体型「${id}」を読み込めませんでした (${response.status})`)
  return response.json()
}

/**
 * @param {object} spec 体型スペック
 * @param {ReturnType<import('./atlas.js').createAtlas>} atlas
 * @returns {THREE.SkinnedMesh}
 */
export function buildBody(spec, atlas, { detail = 'normal', overrides = {}, extras = [] } = {}) {
  const height = spec.height ?? 1.7
  const level = DETAIL_LEVELS[detail] ?? DETAIL_LEVELS.normal
  const { skeleton, root, boneIndex, rest } = createSkeleton({
    height,
    proportions: spec.proportions,
  })

  // 細かさが上がるとパーツが増える。肩・耳・指などは一定の段階から現れる
  const budget = DETAIL_ORDER.indexOf(detail)
  const baseParts = spec.parts ?? []
  const visible = baseParts
    .filter((part) => DETAIL_ORDER.indexOf(part.detail ?? 'low') <= budget)
    // part.id を持つパーツは呼び出し側から差し替えられる（袖丈の切り替えなど）
    .map((part) => (part.id && overrides[part.id] ? { ...part, ...overrides[part.id] } : part))

  // 襟・フード・コートの裾など、体型に合わせて追加する服専用パーツ。
  // from で既存パーツを雛形にするため、4体型それぞれへ絶対寸法を書く必要がない。
  visible.push(...materializeExtras(extras, baseParts))

  const parts = expandParts(visible)
  const uvGroups = computeUvGroups(parts, height, rest)

  const buffers = { position: [], uv: [], skinIndex: [], skinWeight: [] }
  for (const part of parts) {
    appendPart(part, height, rest, boneIndex, buffers, level, uvGroups)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.position, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uv, 2))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(buffers.skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(buffers.skinWeight, 4))
  // 頂点を共有していないため、これだけで面ごとのフラットな法線になる
  geometry.computeVertexNormals()
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(bakeShading(geometry, height), 3))

  const material = new THREE.MeshLambertMaterial({ map: atlas.texture })
  // Blender側のアウトライナで判別できるよう名前を付けておく
  material.name = `${spec.id ?? 'character'}-atlas`
  atlas.texture.name = `${spec.id ?? 'character'}-texture`

  const mesh = new THREE.SkinnedMesh(geometry, material)
  mesh.name = spec.id ?? 'character'
  mesh.add(root)
  mesh.bind(skeleton)
  // スキニングでバウンディングボックスが変わるためカリングを切る
  mesh.frustumCulled = false

  mesh.userData.spec = spec
  return mesh
}

function materializeExtras(extras, baseParts) {
  return extras.map((extra) => {
    const source = baseParts.find((part) =>
      part.id === extra.from || shortBoneName(part.bone) === extra.from,
    )
    if (!source) throw new Error(`服パーツの雛形が見つかりません: ${extra.from}`)

    const { from, ...changes } = extra
    return { ...source, ...changes, mirror: changes.mirror ?? false }
  })
}

/** mirror: true のパーツから、Right側の対を生成する。 */
function expandParts(parts) {
  const out = []
  for (const part of parts) {
    out.push(part)
    if (!part.mirror) continue

    const bone = shortBoneName(part.bone)
    const offset = part.offset ?? [0, 0, 0]
    const taper = part.taper ?? [1, 1]
    const mirrored = {
      ...part,
      // Left系なら対のボーンへ、中央のボーン（耳など）なら同じボーンのまま左右に置く
      bone: bone.startsWith('Left') ? bone.replace('Left', 'Right') : bone,
      offset: [-offset[0], offset[1], offset[2]],
      uvSet: MIRRORED_UV_SETS[part.uvSet] ?? part.uvSet,
      mirror: false,
    }

    // 左右反転にあわせてY・Z軸まわりの回転の符号を返す
    if (part.rotate) {
      mirrored.rotate = [part.rotate[0], -part.rotate[1], -part.rotate[2]]
    }

    // 服の追加パーツは元の offset を維持したまま offsetDelta で左右へ置く。
    // ここを反転しないと、ラペルやコートの左右パネルが同じ側へ重なってしまう。
    if (part.offsetDelta) {
      mirrored.offsetDelta = [-part.offsetDelta[0], part.offsetDelta[1], part.offsetDelta[2]]
    }

    // X軸方向の形状は左右で向きが反転するため、並びを逆にする
    if ((part.taperAxis ?? 'y') === 'x') {
      mirrored.taper = [taper[1], taper[0]]
    }
    if (part.axis === 'x' && part.profile) {
      mirrored.profile = part.profile
        .map(([t, a, b]) => [1 - t, a, b])
        .reverse()
    }

    out.push(mirrored)
  }
  return out
}

function shortBoneName(name) {
  return name.startsWith(BONE_PREFIX) ? name.slice(BONE_PREFIX.length) : name
}

/**
 * 服の種類による形の差し替えは、スペックの値を直接書き換えず倍率とずれで表す。
 *
 * `size` / `offset` は身長比なので、体型ごとに値が違う。
 * 差し替え側が絶対値を書くと体型ごとに用意する羽目になるため、
 * 倍率（scale）と加算（offsetDelta）で指定できるようにしてある。
 */
function partSize(part) {
  const size = part.size ?? [0.1, 0.1, 0.1]
  const scale = part.scale ?? [1, 1, 1]
  return size.map((value, i) => value * (scale[i] ?? 1))
}

function partOffset(part) {
  const offset = part.offset ?? [0, 0, 0]
  const delta = part.offsetDelta ?? [0, 0, 0]
  return offset.map((value, i) => value + (delta[i] ?? 0))
}

/**
 * uvGroup のキー。左右は別グループにする。
 * 同じグループにすると左右の脚で1枚の画像を分け合ってしまい、
 * 片脚ずつ違う柄になる。
 */
function uvGroupKey(part) {
  if (!part.uvGroup) return null
  const bone = shortBoneName(part.bone)
  const side = bone.startsWith('Left') ? 'L' : bone.startsWith('Right') ? 'R' : 'C'
  return `${part.uvGroup}:${side}`
}

/** 同じ uvGroup のパーツをまとめた範囲を求める。UVの正規化にこれを使う。 */
function computeUvGroups(parts, height, rest) {
  const bounds = new Map()

  for (const part of parts) {
    const key = uvGroupKey(part)
    if (!key) continue
    const origin = rest.get(shortBoneName(part.bone))
    if (!origin) continue

    const size = partSize(part)
    const offset = partOffset(part)
    const box = bounds.get(key) ?? { min: {}, max: {} }

    ;['x', 'y', 'z'].forEach((axis, i) => {
      const center = origin[axis] + offset[i] * height
      const half = (size[i] * height) / 2
      box.min[axis] = Math.min(box.min[axis] ?? Infinity, center - half)
      box.max[axis] = Math.max(box.max[axis] ?? -Infinity, center + half)
    })
    bounds.set(key, box)
  }

  const groups = new Map()
  for (const [key, box] of bounds) {
    groups.set(key, {
      center: {
        x: (box.min.x + box.max.x) / 2,
        y: (box.min.y + box.max.y) / 2,
        z: (box.min.z + box.max.z) / 2,
      },
      half: {
        x: (box.max.x - box.min.x) / 2,
        y: (box.max.y - box.min.y) / 2,
        z: (box.max.z - box.min.z) / 2,
      },
    })
  }
  return groups
}

function appendPart(part, height, rest, boneIndex, buffers, level, uvGroups) {
  const bone = shortBoneName(part.bone)
  const origin = rest.get(bone)
  const index = boneIndex.get(bone)
  if (!origin || index === undefined) {
    throw new Error(`未定義のボーンが指定されました: ${part.bone}`)
  }

  const size = partSize(part)
  const offset = partOffset(part)

  const dimensions = {
    half: {
      x: (size[0] * height) / 2,
      y: (size[1] * height) / 2,
      z: (size[2] * height) / 2,
    },
    center: {
      x: origin.x + offset[0] * height,
      y: origin.y + offset[1] * height,
      z: origin.z + offset[2] * height,
    },
  }

  // uvGroup があればグループ全体の範囲でUVを正規化する
  const group = uvGroups?.get(uvGroupKey(part))
  if (group) {
    dimensions.uvCenter = group.center
    dimensions.uvHalf = group.half
  }

  const build = SHAPES[part.shape ?? 'box']
  if (!build) throw new Error(`未定義のshape: ${part.shape}`)

  // 回転は形状生成側に持ち込まず、生成された頂点をあとから回す。
  // これでbox/ringsのどちらにも同じ実装で効く（親指のように傾けたいパーツ向け）
  const start = buffers.position.length
  build(part, dimensions, index, buffers, level)
  if (part.rotate) rotateRange(buffers.position, start, dimensions.center, part.rotate)
}

/**
 * 陰影を頂点カラーに焼き込む（PS1期の実装そのもの）。
 *
 * 面の向きと高さだけで決まるため、別パーツ同士が接していても値が連続する。
 * テクスチャ側にグラデーションを入れる方法は使えない。各パーツが自分の範囲を
 * 独立してUV領域全体へ貼るため、関節で必ず継ぎ目ができてしまう。
 *
 * 下を向いた面ほど暗くなるので、腰の裾や膝の段差の裏側が自然に落ちる。
 */
function bakeShading(geometry, height) {
  const positions = geometry.attributes.position.array
  const normals = geometry.attributes.normal.array
  const colors = new Float32Array(positions.length)

  // 左上手前からの主光源。ここで焼いてしまうため実行時のライトは不要になる
  const lx = 0.45
  const ly = 0.82
  const lz = 0.36
  const len = Math.hypot(lx, ly, lz)

  for (let i = 0; i < positions.length; i += 3) {
    const nx = normals[i]
    const ny = normals[i + 1]
    const nz = normals[i + 2]

    const lambert = Math.max(0, (nx * lx + ny * ly + nz * lz) / len)
    // 下を向いた面ほど落とす。腰の裾や膝の段差の裏側がここで暗くなる
    const sky = ny * 0.5 + 0.5
    const up = Math.min(1, Math.max(0, positions[i + 1] / height))

    const shade = Math.min(
      1,
      (0.42 + 0.58 * lambert) * (0.72 + 0.28 * sky) * (0.94 + 0.06 * up),
    )
    colors[i] = shade
    colors[i + 1] = shade
    colors[i + 2] = shade
  }
  return colors
}

const _euler = new THREE.Euler()
const _matrix = new THREE.Matrix4()
const _point = new THREE.Vector3()

/** パーツ中心まわりに、度で指定された角度で回す。 */
function rotateRange(positions, start, center, degrees) {
  const toRad = Math.PI / 180
  _euler.set(degrees[0] * toRad, degrees[1] * toRad, degrees[2] * toRad)
  _matrix.makeRotationFromEuler(_euler)

  for (let i = start; i < positions.length; i += 3) {
    _point
      .set(positions[i] - center.x, positions[i + 1] - center.y, positions[i + 2] - center.z)
      .applyMatrix4(_matrix)
    positions[i] = _point.x + center.x
    positions[i + 1] = _point.y + center.y
    positions[i + 2] = _point.z + center.z
  }
}

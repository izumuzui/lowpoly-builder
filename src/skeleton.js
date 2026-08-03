/**
 * Mixamo標準の命名・階層でスケルトンを生成する。
 *
 * 座標系: Y-up、キャラクターは +Z を向く。したがってキャラクターの左手は +X 側。
 * 足裏が y=0 に来るように配置する。
 *
 * 位置はすべて「身長を1としたときの比率」で持ち、生成時に height を掛ける。
 * 体型スペックの proportions で個別に上書きできる。
 */
import * as THREE from 'three'

export const BONE_PREFIX = 'mixamorig:'

/** [ボーン名, 親, 身長比のワールド位置]。Left系は自動でRightに鏡像化する。 */
const BONE_TREE = [
  ['Hips', null, [0, 0.53, 0]],
  ['Spine', 'Hips', [0, 0.6, 0]],
  ['Spine1', 'Spine', [0, 0.68, 0]],
  ['Spine2', 'Spine1', [0, 0.76, 0]],
  ['Neck', 'Spine2', [0, 0.83, 0]],
  ['Head', 'Neck', [0, 0.87, 0]],
  ['HeadTop_End', 'Head', [0, 1.0, 0]],

  // 手首間の幅が身長の0.84程度になる配置。実測の人体比に近い
  ['LeftShoulder', 'Spine2', [0.045, 0.805, 0]],
  ['LeftArm', 'LeftShoulder', [0.12, 0.8, 0]],
  ['LeftForeArm', 'LeftArm', [0.27, 0.8, 0]],
  ['LeftHand', 'LeftForeArm', [0.42, 0.8, 0]],

  ['LeftUpLeg', 'Hips', [0.055, 0.52, 0]],
  ['LeftLeg', 'LeftUpLeg', [0.055, 0.285, 0]],
  ['LeftFoot', 'LeftLeg', [0.055, 0.045, 0]],
  ['LeftToeBase', 'LeftFoot', [0.055, 0.012, 0.045]],
  ['LeftToe_End', 'LeftToeBase', [0.055, 0.012, 0.095]],
]

/** Left系を鏡像化してRight系を足した完全なボーン定義。 */
const FULL_TREE = BONE_TREE.flatMap(([name, parent, pos]) => {
  const entry = [name, parent, pos]
  if (!name.startsWith('Left')) return [entry]
  const mirror = (s) => (s && s.startsWith('Left') ? s.replace('Left', 'Right') : s)
  return [entry, [mirror(name), mirror(parent), [-pos[0], pos[1], pos[2]]]]
})

/**
 * スケルトンを生成する。
 *
 * @param {object} options
 * @param {number} options.height 身長（メートル）
 * @param {Record<string, [number, number, number]>} [options.proportions]
 *   ボーン名（接頭辞なし）をキーに、身長比のワールド位置を上書きする
 * @returns {{ skeleton: THREE.Skeleton, root: THREE.Bone, boneIndex: Map<string, number>, rest: Map<string, THREE.Vector3> }}
 */
export function createSkeleton({ height = 1.7, proportions = {} } = {}) {
  const overrides = mirrorProportions(proportions)
  const bones = new Map()
  const boneIndex = new Map()
  const rest = new Map()
  const ordered = []

  for (const [name, parentName, defaultPos] of FULL_TREE) {
    const fraction = overrides[name] ?? defaultPos
    const world = new THREE.Vector3(
      fraction[0] * height,
      fraction[1] * height,
      fraction[2] * height,
    )

    const bone = new THREE.Bone()
    bone.name = BONE_PREFIX + name

    // three.jsのBoneは親からの相対位置を持つため、ワールド位置の差分を入れる
    if (parentName === null) {
      bone.position.copy(world)
    } else {
      const parent = bones.get(parentName)
      if (!parent) throw new Error(`親ボーンが未定義です: ${parentName}`)
      bone.position.copy(world).sub(rest.get(parentName))
      parent.add(bone)
    }

    // ポーズを解除するときに戻せるよう、初期姿勢を控えておく
    bone.userData.restPosition = bone.position.clone()

    bones.set(name, bone)
    rest.set(name, world)
    boneIndex.set(name, ordered.length)
    ordered.push(bone)
  }

  const root = bones.get('Hips')

  // Skeletonはボーンのワールド行列からbindMatrixInverseを算出するため、先に更新しておく
  root.updateMatrixWorld(true)
  const skeleton = new THREE.Skeleton(ordered)

  return { skeleton, root, boneIndex, rest }
}

/**
 * スペックにはLeft側だけ書けば済むよう、Right側の上書き値を補う。
 * 明示的にRight側が書かれている場合はそちらを優先する。
 */
function mirrorProportions(proportions) {
  const merged = { ...proportions }
  for (const [name, pos] of Object.entries(proportions)) {
    if (!name.startsWith('Left')) continue
    const mirrored = name.replace('Left', 'Right')
    if (merged[mirrored]) continue
    merged[mirrored] = [-pos[0], pos[1], pos[2]]
  }
  return merged
}

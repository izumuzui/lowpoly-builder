/**
 * ポーズ。ボーンの回転（度、XYZ順）で表す。
 *
 * 初期姿勢では全ボーンの回転が0なので、ボーンのローカル軸は世界の軸と一致する。
 * そのため「Z軸まわりに-70度で腕が下がる」といった直感的な指定がそのまま使える。
 *
 * Left系だけ書けばRight系は自動で左右反転する（Y・Z軸の符号を返す）。
 * 歩きや手を振るような左右非対称のポーズは、Right系も明示的に書く。
 *
 * hips は腰の位置ずらし（身長比）。座りポーズで腰を落とすのに使う。
 */
import { BONE_PREFIX } from './skeleton.js'

export const POSES = {
  tpose: {
    name: 'Tポーズ',
    note: 'Mixamoの標準。アニメーションを付けるならこれで書き出す',
    bones: {},
  },

  stand: {
    name: '立ち',
    bones: {
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -10, -70],
      LeftForeArm: [0, -6, -14],
      LeftHand: [0, 0, -6],
    },
  },

  walk: {
    name: '歩き',
    bones: {
      Spine1: [2, 0, 0],
      // 腕は左右で前後が逆になるため、両方を明示する
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, 26, -68],
      LeftForeArm: [0, 0, -22],
      RightShoulder: [0, 0, 5],
      RightArm: [0, 26, 68],
      RightForeArm: [0, 0, 22],

      LeftUpLeg: [-24, 0, 2],
      LeftLeg: [12, 0, 0],
      LeftFoot: [8, 0, 0],
      RightUpLeg: [18, 0, -2],
      RightLeg: [36, 0, 0],
      RightFoot: [-16, 0, 0],
    },
  },

  sit: {
    name: '座り',
    hips: [0, -0.245, -0.02],
    bones: {
      LeftUpLeg: [-84, 0, 4],
      LeftLeg: [80, 0, 0],
      LeftFoot: [6, 0, 0],
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -14, -64],
      LeftForeArm: [0, -34, -34],
    },
  },

  wave: {
    name: '手を振る',
    bones: {
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -10, -70],
      LeftForeArm: [0, -6, -14],
      RightShoulder: [0, 0, 12],
      RightArm: [0, 0, -28],
      RightForeArm: [0, 0, -78],
      RightHand: [0, 0, -12],
    },
  },

  run: {
    name: '走り',
    hips: [0, 0.012, 0],
    bones: {
      Spine1: [7, 0, 0],
      LeftShoulder: [0, 0, -6],
      LeftArm: [0, 52, -60],
      LeftForeArm: [0, 0, -88],
      RightShoulder: [0, 0, 6],
      RightArm: [0, 46, 60],
      RightForeArm: [0, 0, 88],

      LeftUpLeg: [-46, 0, 3],
      LeftLeg: [26, 0, 0],
      LeftFoot: [14, 0, 0],
      RightUpLeg: [30, 0, -3],
      RightLeg: [82, 0, 0],
      RightFoot: [-26, 0, 0],
    },
  },

  jump: {
    name: 'ジャンプ',
    hips: [0, 0.055, 0],
    bones: {
      LeftShoulder: [0, 0, 8],
      LeftArm: [0, -12, 58],
      LeftForeArm: [0, 0, 18],
      LeftUpLeg: [-32, 0, 5],
      LeftLeg: [58, 0, 0],
      LeftFoot: [-16, 0, 0],
    },
  },

  crouch: {
    name: 'しゃがみ',
    hips: [0, -0.3, -0.03],
    bones: {
      Spine1: [13, 0, 0],
      LeftUpLeg: [-96, 0, 9],
      LeftLeg: [104, 0, 0],
      LeftFoot: [-8, 0, 0],
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -22, -56],
      LeftForeArm: [0, -32, -44],
    },
  },

  armsCrossed: {
    name: '腕組み',
    bones: {
      LeftShoulder: [0, 0, -4],
      LeftArm: [0, -40, -58],
      LeftForeArm: [0, -76, -26],
    },
  },

  think: {
    name: '考える',
    bones: {
      Head: [8, -12, 0],
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -10, -70],
      LeftForeArm: [0, -6, -14],
      RightShoulder: [0, 0, 8],
      RightArm: [0, -26, -52],
      RightForeArm: [0, -22, -72],
    },
  },

  point: {
    name: '指差す',
    bones: {
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -10, -70],
      LeftForeArm: [0, -6, -14],
      RightShoulder: [0, 0, 6],
      RightArm: [0, 86, 10],
      RightForeArm: [0, 0, 4],
    },
  },

  cheer: {
    name: '万歳',
    bones: {
      Spine1: [-5, 0, 0],
      Head: [-7, 0, 0],
      LeftShoulder: [0, 0, 10],
      LeftArm: [0, -8, 72],
      LeftForeArm: [0, 0, 12],
    },
  },

  salute: {
    name: '敬礼',
    bones: {
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -10, -70],
      LeftForeArm: [0, -6, -14],
      RightShoulder: [0, 0, 10],
      RightArm: [0, -34, -18],
      RightForeArm: [0, -58, -96],
      RightHand: [0, 0, -12],
    },
  },

  handsOnHips: {
    name: '腰に手',
    bones: {
      LeftShoulder: [0, 0, -4],
      LeftArm: [0, -26, -56],
      LeftForeArm: [0, -70, -32],
    },
  },

  bow: {
    name: 'お辞儀',
    bones: {
      Spine: [22, 0, 0],
      Spine1: [12, 0, 0],
      Spine2: [7, 0, 0],
      Head: [-15, 0, 0],
      LeftShoulder: [0, 0, -5],
      LeftArm: [0, -8, -76],
      LeftForeArm: [0, -4, -8],
    },
  },
}

const DEG = Math.PI / 180

/**
 * メッシュにポーズを適用する。
 * 指定のないボーンは初期姿勢へ戻すため、切り替えは呼び直すだけでよい。
 */
export function applyPose(mesh, poseId) {
  const pose = POSES[poseId] ?? POSES.tpose
  const rotations = expandMirror(pose.bones)
  const height = mesh.userData.spec?.height ?? 1.7

  for (const bone of mesh.skeleton.bones) {
    const name = bone.name.startsWith(BONE_PREFIX)
      ? bone.name.slice(BONE_PREFIX.length)
      : bone.name

    const rotation = rotations[name]
    if (rotation) {
      bone.rotation.set(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG)
    } else {
      bone.rotation.set(0, 0, 0)
    }

    if (name === 'Hips') {
      bone.position.copy(bone.userData.restPosition)
      if (pose.hips) {
        bone.position.x += pose.hips[0] * height
        bone.position.y += pose.hips[1] * height
        bone.position.z += pose.hips[2] * height
      }
    }
  }

  mesh.skeleton.bones[0].updateMatrixWorld(true)
}

/** Left系からRight系を補う。明示的に書かれている場合はそちらを優先する。 */
function expandMirror(bones) {
  const out = { ...bones }
  for (const [name, rotation] of Object.entries(bones)) {
    if (!name.startsWith('Left')) continue
    const mirrored = name.replace('Left', 'Right')
    if (out[mirrored]) continue
    out[mirrored] = [rotation[0], -rotation[1], -rotation[2]]
  }
  return out
}

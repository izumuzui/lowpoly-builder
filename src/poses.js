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

  relaxed: {
    name: 'リラックス',
    hips: [0.012, -0.008, 0],
    bones: {
      Spine1: [1, -3, -2],
      Head: [1, 4, 1],
      LeftArm: [0, -12, -72],
      LeftForeArm: [0, -8, -10],
      RightArm: [0, 8, 68],
      RightForeArm: [0, 5, 18],
      LeftUpLeg: [-4, 0, 4],
      RightUpLeg: [7, 0, -5],
      RightLeg: [8, 0, 0],
    },
  },

  attention: {
    name: '気をつけ',
    bones: {
      LeftShoulder: [0, 0, -3],
      LeftArm: [0, -4, -82],
      LeftForeArm: [0, 0, -5],
      LeftHand: [0, 0, -3],
    },
  },

  weightShift: {
    name: '片足重心',
    hips: [0.018, -0.01, 0],
    bones: {
      Spine: [0, 0, -3],
      Spine1: [0, 0, 4],
      Head: [0, -5, -2],
      LeftArm: [0, -10, -72],
      LeftForeArm: [0, -8, -12],
      RightArm: [0, 12, 66],
      RightForeArm: [0, 8, 24],
      LeftUpLeg: [0, 0, 4],
      RightUpLeg: [10, 0, -9],
      RightLeg: [18, 0, 0],
      RightFoot: [-8, 0, 0],
    },
  },

  lookBack: {
    name: '振り向く',
    bones: {
      Hips: [0, -8, 0],
      Spine: [0, 16, 0],
      Spine1: [0, 20, 0],
      Spine2: [0, 12, 0],
      Head: [0, 34, 0],
      LeftArm: [0, -14, -70],
      LeftForeArm: [0, -10, -16],
      RightArm: [0, 16, 68],
      RightForeArm: [0, 12, 22],
    },
  },

  lookUp: {
    name: '見上げる',
    bones: {
      Spine1: [-3, 0, 0],
      Head: [-24, 0, 0],
      LeftArm: [0, -10, -72],
      LeftForeArm: [0, -6, -12],
    },
  },

  lookDown: {
    name: '見下ろす',
    bones: {
      Spine1: [5, 0, 0],
      Head: [25, 0, 0],
      LeftArm: [0, -8, -76],
      LeftForeArm: [0, -5, -8],
    },
  },

  handsBehind: {
    name: '手を後ろで組む',
    bones: {
      Spine1: [-3, 0, 0],
      LeftArm: [0, 30, -68],
      LeftForeArm: [0, 48, -48],
      RightArm: [0, -30, 68],
      RightForeArm: [0, -48, 48],
    },
  },

  handsFront: {
    name: '手を前で組む',
    bones: {
      LeftArm: [0, -34, -58],
      LeftForeArm: [0, -68, -48],
      RightArm: [0, 34, 58],
      RightForeArm: [0, 68, 48],
    },
  },

  handRaised: {
    name: '片手を上げる',
    bones: {
      LeftArm: [0, -10, -72],
      LeftForeArm: [0, -6, -12],
      RightShoulder: [0, 0, 8],
      RightArm: [0, 0, -8],
      RightForeArm: [0, 0, -76],
      RightHand: [0, 0, -8],
    },
  },

  openArms: {
    name: '両手を広げる',
    bones: {
      Spine1: [-2, 0, 0],
      LeftShoulder: [0, 0, 4],
      LeftArm: [0, -18, -22],
      LeftForeArm: [0, -8, -12],
      RightShoulder: [0, 0, -4],
      RightArm: [0, 18, 22],
      RightForeArm: [0, 8, 12],
    },
  },

  clap: {
    name: '拍手',
    bones: {
      LeftArm: [0, -46, -46],
      LeftForeArm: [0, -66, -62],
      RightArm: [0, 46, 46],
      RightForeArm: [0, 66, 62],
    },
  },

  fistPump: {
    name: 'ガッツポーズ',
    bones: {
      Spine1: [-4, 5, 0],
      Head: [-5, -6, 0],
      LeftArm: [0, -12, -70],
      LeftForeArm: [0, -8, -14],
      RightShoulder: [0, 0, -6],
      RightArm: [0, 18, -18],
      RightForeArm: [0, 12, -96],
    },
  },

  dance: {
    name: 'ダンス',
    hips: [0.014, 0.012, 0],
    bones: {
      Spine: [0, -8, -5],
      Spine1: [-5, 12, 7],
      Head: [-4, -14, -5],
      LeftArm: [0, -24, 42],
      LeftForeArm: [0, -28, 62],
      RightArm: [0, 30, 68],
      RightForeArm: [0, 24, 84],
      LeftUpLeg: [-18, 0, 8],
      LeftLeg: [28, 0, 0],
      RightUpLeg: [20, 0, -10],
      RightLeg: [44, 0, 0],
      RightFoot: [-18, 0, 0],
    },
  },

  stretch: {
    name: 'ストレッチ',
    bones: {
      Spine: [-4, 0, 0],
      Spine1: [-8, 0, 0],
      Head: [5, 0, 0],
      LeftShoulder: [0, 0, 8],
      LeftArm: [0, -4, 70],
      LeftForeArm: [0, -8, 14],
    },
  },

  breathe: {
    name: '深呼吸',
    bones: {
      Spine1: [-5, 0, 0],
      Head: [-8, 0, 0],
      LeftArm: [0, -28, -48],
      LeftForeArm: [0, -26, -28],
      RightArm: [0, 28, 48],
      RightForeArm: [0, 26, 28],
    },
  },

  surprised: {
    name: '驚く',
    hips: [0, 0.01, 0],
    bones: {
      Spine1: [-6, 0, 0],
      Head: [8, 0, 0],
      LeftShoulder: [0, 0, 8],
      LeftArm: [0, -28, -38],
      LeftForeArm: [0, -30, -68],
    },
  },

  shrug: {
    name: '困る',
    bones: {
      Head: [3, -8, 4],
      LeftShoulder: [0, 0, 10],
      LeftArm: [0, -30, -52],
      LeftForeArm: [0, -28, -72],
      RightShoulder: [0, 0, -10],
      RightArm: [0, 30, 52],
      RightForeArm: [0, 28, 72],
    },
  },

  dejected: {
    name: '落ち込む',
    bones: {
      Spine: [7, 0, 0],
      Spine1: [11, 0, 0],
      Spine2: [7, 0, 0],
      Head: [22, 0, 0],
      LeftShoulder: [0, 0, -7],
      LeftArm: [0, -6, -78],
      LeftForeArm: [0, -4, -8],
    },
  },

  laugh: {
    name: '笑う',
    bones: {
      Spine: [-4, 0, 0],
      Spine1: [-7, 0, 0],
      Head: [-8, 4, 0],
      LeftArm: [0, -38, -54],
      LeftForeArm: [0, -58, -64],
      RightArm: [0, 26, 62],
      RightForeArm: [0, 42, 54],
    },
  },

  photoPose: {
    name: '写真ポーズ',
    hips: [0.014, -0.008, 0],
    bones: {
      Spine1: [0, -6, 4],
      Head: [-2, 8, -4],
      LeftArm: [0, -32, -58],
      LeftForeArm: [0, -70, -34],
      RightShoulder: [0, 0, 8],
      RightArm: [0, -28, -40],
      RightForeArm: [0, -48, -94],
      RightHand: [0, 0, -12],
      LeftUpLeg: [-3, 0, 5],
      RightUpLeg: [10, 0, -7],
      RightLeg: [16, 0, 0],
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

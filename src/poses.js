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

  ready: {
    name: '構え',
    hips: [0, -0.025, 0],
    bones: {
      Spine1: [5, 0, 0],
      LeftShoulder: [0, 0, -4],
      LeftArm: [0, -34, -48],
      LeftForeArm: [0, -28, -46],
      LeftUpLeg: [-14, 0, 7],
      LeftLeg: [24, 0, 0],
      RightUpLeg: [9, 0, -7],
      RightLeg: [18, 0, 0],
    },
  },

  guard: {
    name: 'ガード',
    hips: [0, -0.04, 0],
    bones: {
      Spine1: [8, 8, 0],
      LeftArm: [0, -50, -40],
      LeftForeArm: [0, -58, -72],
      RightArm: [0, 42, 46],
      RightForeArm: [0, 52, 70],
      LeftUpLeg: [-22, 0, 8],
      LeftLeg: [34, 0, 0],
      RightUpLeg: [12, 0, -8],
      RightLeg: [24, 0, 0],
    },
  },

  swordStance: {
    name: '片手剣',
    hips: [0, -0.02, 0],
    bones: {
      Spine1: [4, -12, 0],
      LeftArm: [0, -42, -48],
      LeftForeArm: [0, -46, -52],
      RightArm: [0, 28, 52],
      RightForeArm: [0, 18, 38],
      LeftUpLeg: [-18, 0, 7],
      LeftLeg: [28, 0, 0],
      RightUpLeg: [10, 0, -6],
      RightLeg: [14, 0, 0],
    },
  },

  heavyWeapon: {
    name: '大剣',
    hips: [0, -0.035, 0],
    bones: {
      Spine1: [10, -8, 0],
      LeftShoulder: [0, 0, 5],
      LeftArm: [0, -22, 34],
      LeftForeArm: [0, -54, -58],
      RightShoulder: [0, 0, -4],
      RightArm: [0, 30, -28],
      RightForeArm: [0, 52, 60],
      LeftUpLeg: [-20, 0, 8],
      LeftLeg: [32, 0, 0],
      RightUpLeg: [12, 0, -8],
      RightLeg: [20, 0, 0],
    },
  },

  lanceGuard: {
    name: 'ランス',
    hips: [0, -0.055, 0],
    bones: {
      Spine1: [7, 10, 0],
      LeftArm: [0, -58, -32],
      LeftForeArm: [0, -62, -70],
      RightArm: [0, 82, 18],
      RightForeArm: [0, 4, 16],
      LeftUpLeg: [-28, 0, 10],
      LeftLeg: [44, 0, 0],
      RightUpLeg: [15, 0, -10],
      RightLeg: [28, 0, 0],
    },
  },

  bowAim: {
    name: '弓を構える',
    bones: {
      Spine1: [0, -18, 0],
      Head: [0, 14, 0],
      LeftArm: [0, 88, 4],
      LeftForeArm: [0, 2, 3],
      RightArm: [0, -58, -18],
      RightForeArm: [0, -74, -108],
      RightHand: [0, 0, -12],
      LeftUpLeg: [-8, 0, 4],
      RightUpLeg: [8, 0, -4],
    },
  },

  dualBlades: {
    name: '双剣',
    hips: [0, -0.035, 0],
    bones: {
      Spine1: [11, -8, 0],
      LeftArm: [0, -48, -36],
      LeftForeArm: [0, -20, -64],
      RightArm: [0, 54, 38],
      RightForeArm: [0, 22, 68],
      LeftUpLeg: [-30, 0, 9],
      LeftLeg: [46, 0, 0],
      RightUpLeg: [18, 0, -8],
      RightLeg: [28, 0, 0],
    },
  },

  hammerCharge: {
    name: 'ハンマー',
    hips: [0, -0.03, 0],
    bones: {
      Spine1: [-5, 6, 0],
      Head: [8, -6, 0],
      LeftShoulder: [0, 0, 9],
      LeftArm: [0, -20, 62],
      LeftForeArm: [0, -42, -58],
      RightShoulder: [0, 0, -9],
      RightArm: [0, 20, -62],
      RightForeArm: [0, 42, 58],
      LeftUpLeg: [-16, 0, 7],
      LeftLeg: [26, 0, 0],
      RightUpLeg: [10, 0, -7],
      RightLeg: [18, 0, 0],
    },
  },

  gather: {
    name: '採集',
    hips: [0, -0.24, -0.02],
    bones: {
      Spine: [18, 0, 0],
      Spine1: [12, 0, 0],
      Head: [-16, 0, 0],
      LeftArm: [0, -26, -54],
      LeftForeArm: [0, -40, -54],
      LeftUpLeg: [-72, 0, 8],
      LeftLeg: [88, 0, 0],
      RightUpLeg: [-54, 0, -8],
      RightLeg: [72, 0, 0],
    },
  },

  carve: {
    name: '剥ぎ取り',
    hips: [0, -0.27, -0.02],
    bones: {
      Spine: [24, 0, 0],
      Spine1: [15, -10, 0],
      Head: [-18, 8, 0],
      LeftArm: [0, -42, -42],
      LeftForeArm: [0, -56, -58],
      RightArm: [0, 34, 46],
      RightForeArm: [0, 50, 58],
      LeftUpLeg: [-88, 0, 8],
      LeftLeg: [98, 0, 0],
      RightUpLeg: [-62, 0, -8],
      RightLeg: [82, 0, 0],
    },
  },

  track: {
    name: '痕跡を調べる',
    hips: [0, -0.12, 0],
    bones: {
      Spine: [20, 0, 0],
      Spine1: [15, 8, 0],
      Head: [6, -14, 0],
      LeftArm: [0, -18, -66],
      LeftForeArm: [0, -34, -38],
      RightArm: [0, 34, 56],
      RightForeArm: [0, 30, 62],
      LeftUpLeg: [-48, 0, 7],
      LeftLeg: [64, 0, 0],
      RightUpLeg: [-34, 0, -7],
      RightLeg: [52, 0, 0],
    },
  },

  drink: {
    name: '回復',
    bones: {
      Head: [-10, 0, 0],
      LeftArm: [0, -10, -70],
      LeftForeArm: [0, -6, -14],
      RightShoulder: [0, 0, 8],
      RightArm: [0, -30, -34],
      RightForeArm: [0, -52, -112],
      RightHand: [18, 0, -12],
    },
  },

  victory: {
    name: '勝利',
    hips: [0, 0.018, 0],
    bones: {
      Spine1: [-7, 8, 0],
      Head: [-8, -8, 0],
      LeftArm: [0, -16, 68],
      LeftForeArm: [0, -20, 36],
      RightArm: [0, 28, 40],
      RightForeArm: [0, 58, 82],
      LeftUpLeg: [-8, 0, 4],
      RightUpLeg: [8, 0, -4],
    },
  },

  shout: {
    name: '雄叫び',
    bones: {
      Spine1: [-8, 0, 0],
      Head: [-14, 0, 0],
      LeftShoulder: [0, 0, 8],
      LeftArm: [0, -32, 48],
      LeftForeArm: [0, -30, 76],
      LeftUpLeg: [-12, 0, 6],
      LeftLeg: [20, 0, 0],
    },
  },

  hit: {
    name: 'ダメージ',
    hips: [0, -0.025, 0.02],
    bones: {
      Spine: [-10, 12, 0],
      Spine1: [-16, 10, 0],
      Head: [14, -12, 8],
      LeftArm: [0, -18, -32],
      LeftForeArm: [0, -12, -36],
      RightArm: [0, 32, 58],
      RightForeArm: [0, 18, 32],
      LeftUpLeg: [10, 0, 5],
      RightUpLeg: [-18, 0, -5],
      RightLeg: [28, 0, 0],
    },
  },

  down: {
    name: 'ダウン',
    hips: [0, -0.43, 0.08],
    bones: {
      Hips: [76, 0, 8],
      Spine1: [8, 0, 0],
      Head: [-12, 12, 0],
      LeftArm: [0, -16, -42],
      LeftForeArm: [0, -18, -26],
      LeftUpLeg: [-24, 0, 10],
      LeftLeg: [42, 0, 0],
      RightUpLeg: [18, 0, -10],
      RightLeg: [30, 0, 0],
    },
  },

  sneak: {
    name: '忍び歩き',
    hips: [0, -0.16, -0.02],
    bones: {
      Spine: [16, 0, 0],
      Spine1: [12, 0, 0],
      Head: [-12, 8, 0],
      LeftArm: [0, -24, -52],
      LeftForeArm: [0, -38, -52],
      RightArm: [0, 22, 56],
      RightForeArm: [0, 34, 58],
      LeftUpLeg: [-58, 0, 9],
      LeftLeg: [76, 0, 0],
      RightUpLeg: [-38, 0, -8],
      RightLeg: [60, 0, 0],
    },
  },

  kneel: {
    name: '片膝立ち',
    hips: [0, -0.28, 0],
    bones: {
      Spine1: [8, 0, 0],
      LeftArm: [0, -24, -58],
      LeftForeArm: [0, -36, -42],
      RightArm: [0, 24, 58],
      RightForeArm: [0, 36, 42],
      LeftUpLeg: [-82, 0, 7],
      LeftLeg: [88, 0, 0],
      RightUpLeg: [10, 0, -6],
      RightLeg: [84, 0, 0],
      RightFoot: [-22, 0, 0],
    },
  },

  campRest: {
    name: 'キャンプ休憩',
    hips: [0, -0.31, -0.02],
    bones: {
      Spine1: [6, 0, 0],
      Head: [4, 10, 0],
      LeftArm: [0, -18, -56],
      LeftForeArm: [0, -44, -48],
      RightArm: [0, 18, 56],
      RightForeArm: [0, 44, 48],
      LeftUpLeg: [-92, 0, 12],
      LeftLeg: [82, 0, 0],
      RightUpLeg: [-92, 0, -12],
      RightLeg: [82, 0, 0],
    },
  },

  carryHeavy: {
    name: '重い物を運ぶ',
    hips: [0, -0.04, 0],
    bones: {
      Spine: [14, 0, 0],
      Spine1: [12, 0, 0],
      Head: [-10, 0, 0],
      LeftArm: [0, -48, -38],
      LeftForeArm: [0, -64, -82],
      RightArm: [0, 48, 38],
      RightForeArm: [0, 64, 82],
      LeftUpLeg: [-18, 0, 7],
      LeftLeg: [30, 0, 0],
      RightUpLeg: [12, 0, -7],
      RightLeg: [22, 0, 0],
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

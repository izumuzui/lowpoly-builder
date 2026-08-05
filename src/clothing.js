/**
 * 服の種類。パーツのUV領域と形を差し替える定義。
 *
 * override は既存パーツの uvSet / scale / offsetDelta / profile を差し替える。
 * extras は既存パーツを雛形に、襟・フード・裾などの服専用形状を追加する。
 * 形は絶対値ではなく倍率で指定する。size は身長比で体型ごとに違うため、
 * 絶対値で書くと体型の数だけ用意する羽目になる。
 *
 * 袖丈は独立した設定にしていない。タンクトップの袖丈は意味を持たないため、
 * 種類の側に含めてある。
 */

export const TOPS = [
  {
    id: 'tank',
    name: 'タンクトップ',
    override: {
      shoulder: { uvSet: 'skin' },
      upperArm: { uvSet: 'skin' },
      chest: {
        scale: [0.98, 1, 0.98],
        profile: [[0, 0.86, 0.9], [0.34, 0.96, 0.98], [0.72, 1, 1], [1, 0.9, 0.9]],
      },
    },
  },
  {
    id: 'tshirt',
    name: 'Tシャツ',
    override: {
      // 腰から下はボトムスの領域に渡す。torso のままだとTシャツ写真が骨盤メッシュまで
      // 描かれ、ズボンの上に裾が垂れ下がって見える。
      pelvis: { uvSet: 'legs' },
      shoulder: {
        profile: [[0, 0.68, 0.7], [0.28, 1, 1], [0.72, 0.96, 0.96], [1, 0.82, 0.82]],
      },
      upperArm: {
        profile: [[0, 1, 1], [0.28, 1.03, 1.03], [0.72, 0.97, 0.97], [1, 0.84, 0.84]],
      },
    },
  },
  {
    id: 'baggyTshirt',
    name: 'ダボダボTシャツ',
    override: {
      shoulder: {
        scale: [1.12, 1.28, 1.3],
        profile: [[0, 0.82, 0.84], [0.24, 1.08, 1.08], [0.72, 1.04, 1.04], [1, 0.94, 0.94]],
      },
      upperArm: {
        scale: [1.16, 1.32, 1.32],
        profile: [[0, 1.04, 1.04], [0.28, 1.08, 1.08], [0.72, 1.02, 1.02], [1, 0.92, 0.92]],
      },
      chest: {
        scale: [1.18, 1.08, 1.18],
        profile: [[0, 1.02, 1.02], [0.28, 1.04, 1.04], [0.72, 1.02, 1.02], [1, 0.96, 0.98]],
      },
      abdomen: {
        scale: [1.23, 1.24, 1.2],
        offsetDelta: [0, -0.012, 0],
        profile: [[0, 1.08, 1.06], [0.42, 1.05, 1.04], [0.82, 1, 1], [1, 0.98, 0.99]],
      },
      pelvis: {
        scale: [1.16, 1.1, 1.14],
        offsetDelta: [0, -0.006, 0],
        profile: [[0, 1.06, 1.04], [0.48, 1.04, 1.03], [1, 0.98, 0.99]],
      },
    },
  },
  {
    id: 'openShirt',
    name: '開襟シャツ',
    override: {
      chest: {
        scale: [1.05, 1, 1.05],
        profile: [[0, 0.9, 0.94], [0.3, 0.98, 1], [0.7, 1, 1], [1, 0.92, 0.92]],
      },
      abdomen: {
        scale: [1.07, 1.08, 1.06],
        profile: [[0, 1.04, 1.04], [0.45, 1, 1], [1, 0.97, 0.98]],
      },
      upperArm: { scale: [1, 1.08, 1.08] },
    },
    extras: [
      {
        from: 'Neck',
        id: 'openCollar',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [1.65, 0.55, 1.55],
        offsetDelta: [0, -0.008, 0],
        profile: [[0, 1.06, 1.04], [0.45, 1, 1], [1, 0.9, 0.92]],
        omitFacings: ['pz'],
      },
      {
        from: 'chest',
        id: 'openNeck',
        shape: 'wedge',
        uvSet: 'skin',
        uvGroup: null,
        scale: [0.32, 0.56, 0.22],
        offsetDelta: [0, 0.014, 0.078],
      },
      {
        from: 'chest',
        id: 'openLapel',
        shape: 'box',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.18, 0.56, 0.28],
        offsetDelta: [0.048, 0.032, 0.084],
        rotate: [0, 0, -24],
        mirror: true,
      },
    ],
  },
  {
    id: 'longShirt',
    name: '長袖シャツ',
    override: {
      forearm: {
        uvSet: 'sleeve',
        scale: [1, 1.05, 1.05],
        profile: [[0, 0.88, 0.88], [0.2, 0.94, 0.94], [0.72, 1, 1], [1, 0.96, 0.96]],
      },
      upperArm: {
        profile: [[0, 1, 1], [0.35, 1.03, 1.03], [0.75, 0.97, 0.97], [1, 0.9, 0.9]],
      },
    },
    extras: [
      {
        from: 'Neck',
        id: 'shirtCollar',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [1.55, 0.42, 1.4],
        offsetDelta: [0, -0.004, 0],
        profile: [[0, 1.04, 1.02], [1, 0.92, 0.94]],
        omitFacings: ['pz'],
      },
      {
        from: 'chest',
        id: 'shirtPlacket',
        shape: 'box',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.035, 1.25, 0.1],
        offsetDelta: [0, -0.028, 0.07],
      },
      {
        from: 'forearm',
        id: 'shirtCuff',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.18, 1.18, 1.18],
        offsetDelta: [0.065, 0, 0],
        profile: [[0, 0.96, 0.96], [1, 1, 1]],
        mirror: true,
      },
    ],
  },
  {
    id: 'baggyLongShirt',
    name: 'ダボダボ長袖シャツ',
    override: {
      forearm: {
        uvSet: 'sleeve',
        scale: [1.06, 1.38, 1.38],
        profile: [[0, 0.78, 0.78], [0.18, 0.92, 0.92], [0.68, 1.08, 1.08], [1, 1.02, 1.02]],
      },
      upperArm: {
        scale: [1.08, 1.32, 1.32],
        profile: [[0, 1.04, 1.04], [0.3, 1.08, 1.08], [0.75, 1.04, 1.04], [1, 0.96, 0.96]],
      },
      shoulder: { scale: [1.1, 1.28, 1.28] },
      chest: {
        scale: [1.16, 1.08, 1.16],
        profile: [[0, 1.02, 1.02], [0.32, 1.04, 1.04], [0.76, 1.02, 1.02], [1, 0.97, 0.98]],
      },
      abdomen: {
        scale: [1.22, 1.22, 1.2],
        offsetDelta: [0, -0.01, 0],
        profile: [[0, 1.08, 1.06], [0.44, 1.04, 1.04], [1, 0.98, 0.99]],
      },
      pelvis: { scale: [1.14, 1.08, 1.12], offsetDelta: [0, -0.004, 0] },
    },
    extras: [
      {
        from: 'Neck',
        id: 'baggyShirtCollar',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [1.66, 0.44, 1.48],
        offsetDelta: [0, -0.004, 0],
        profile: [[0, 1.06, 1.04], [1, 0.92, 0.94]],
        omitFacings: ['pz'],
      },
      {
        from: 'chest',
        id: 'baggyShirtPlacket',
        shape: 'box',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.035, 1.25, 0.1],
        offsetDelta: [0, -0.028, 0.08],
      },
      {
        from: 'forearm',
        id: 'baggyShirtCuff',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.18, 1.1, 1.1],
        offsetDelta: [0.065, 0, 0],
        profile: [[0, 0.96, 0.96], [1, 1, 1]],
        mirror: true,
      },
    ],
  },
  {
    id: 'hoodie',
    name: 'パーカー',
    override: {
      forearm: {
        uvSet: 'sleeve',
        scale: [1, 1.14, 1.14],
        profile: [[0, 0.82, 0.84], [0.18, 0.96, 0.98], [0.7, 1, 1], [1, 0.94, 0.94]],
      },
      upperArm: {
        scale: [1, 1.14, 1.14],
        profile: [[0, 1, 1], [0.3, 1.06, 1.06], [0.78, 1, 1], [1, 0.9, 0.9]],
      },
      shoulder: { scale: [1.06, 1.08, 1.08] },
      chest: {
        scale: [1.1, 1, 1.12],
        profile: [[0, 0.96, 0.98], [0.28, 1, 1], [0.72, 1, 1], [1, 0.94, 0.96]],
      },
      abdomen: {
        scale: [1.12, 1.1, 1.14],
        profile: [[0, 1.04, 1.04], [0.38, 1, 1], [0.8, 0.98, 1], [1, 0.96, 0.98]],
      },
    },
    extras: [
      {
        from: 'Head',
        id: 'hood',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [1.2, 0.92, 1.26],
        offsetDelta: [0, -0.02, -0.025],
        profile: [[0, 0.64, 0.68], [0.18, 0.92, 0.94], [0.52, 1.04, 1.06], [0.82, 1, 1.02], [1, 0.72, 0.76]],
        omitFacings: ['pz'],
      },
      {
        from: 'Neck',
        id: 'hoodOpening',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [2.45, 0.82, 2.2],
        offsetDelta: [0, -0.008, -0.008],
        profile: [[0, 1.08, 1.04], [0.45, 1, 1], [1, 0.82, 0.86]],
      },
      {
        from: 'abdomen',
        id: 'hoodiePocket',
        shape: 'box',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.62, 0.34, 0.18],
        offsetDelta: [0, -0.025, 0.066],
      },
    ],
  },
  {
    id: 'baggyHoodie',
    name: 'ダボダボパーカー',
    override: {
      forearm: {
        uvSet: 'sleeve',
        scale: [1.06, 1.42, 1.42],
        profile: [[0, 0.74, 0.76], [0.16, 0.9, 0.92], [0.68, 1.1, 1.1], [1, 1.03, 1.03]],
      },
      upperArm: {
        scale: [1.1, 1.42, 1.42],
        profile: [[0, 1.06, 1.06], [0.3, 1.1, 1.1], [0.76, 1.05, 1.05], [1, 0.96, 0.96]],
      },
      shoulder: { scale: [1.14, 1.35, 1.35] },
      chest: {
        scale: [1.24, 1.12, 1.25],
        profile: [[0, 1.04, 1.04], [0.3, 1.06, 1.06], [0.75, 1.04, 1.04], [1, 0.98, 1]],
      },
      abdomen: {
        scale: [1.3, 1.28, 1.28],
        offsetDelta: [0, -0.014, 0],
        profile: [[0, 1.1, 1.08], [0.36, 1.08, 1.07], [0.8, 1.02, 1.03], [1, 0.99, 1]],
      },
      pelvis: { scale: [1.18, 1.12, 1.18], offsetDelta: [0, -0.006, 0] },
    },
    extras: [
      {
        from: 'Head',
        id: 'baggyHood',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [1.34, 1.02, 1.4],
        offsetDelta: [0, -0.022, -0.03],
        profile: [[0, 0.66, 0.7], [0.18, 0.94, 0.96], [0.52, 1.06, 1.08], [0.82, 1.02, 1.04], [1, 0.74, 0.78]],
        omitFacings: ['pz'],
      },
      {
        from: 'Neck',
        id: 'baggyHoodOpening',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [2.62, 0.88, 2.38],
        offsetDelta: [0, -0.01, -0.01],
        profile: [[0, 1.08, 1.04], [0.45, 1, 1], [1, 0.82, 0.86]],
      },
      {
        from: 'abdomen',
        id: 'baggyHoodiePocket',
        shape: 'box',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.7, 0.36, 0.19],
        offsetDelta: [0, -0.028, 0.074],
      },
    ],
  },
  {
    id: 'jacket',
    name: 'ジャケット',
    override: {
      forearm: {
        uvSet: 'sleeve',
        scale: [1, 1.08, 1.08],
        profile: [[0, 0.88, 0.88], [0.2, 0.98, 0.98], [0.75, 1, 1], [1, 0.94, 0.94]],
      },
      upperArm: { scale: [1, 1.12, 1.12] },
      shoulder: { scale: [1.14, 1.16, 1.16] },
      chest: {
        scale: [1.1, 1, 1.11],
        profile: [[0, 0.94, 0.96], [0.32, 1, 1], [0.72, 1, 0.99], [1, 0.9, 0.9]],
      },
      abdomen: {
        scale: [1.08, 1.14, 1.1],
        offsetDelta: [0, -0.008, 0],
        profile: [[0, 1.05, 1.04], [0.35, 1.02, 1.02], [0.78, 0.98, 1], [1, 0.96, 0.98]],
      },
    },
  },
  {
    id: 'baggyJacket',
    name: 'ダボダボジャケット',
    override: {
      forearm: {
        uvSet: 'sleeve',
        scale: [1.05, 1.34, 1.34],
        profile: [[0, 0.78, 0.8], [0.18, 0.92, 0.94], [0.72, 1.08, 1.08], [1, 1.02, 1.02]],
      },
      upperArm: { scale: [1.1, 1.38, 1.38] },
      shoulder: { scale: [1.16, 1.34, 1.34] },
      chest: {
        scale: [1.24, 1.12, 1.24],
        profile: [[0, 1.04, 1.04], [0.3, 1.07, 1.07], [0.74, 1.04, 1.04], [1, 0.97, 0.99]],
      },
      abdomen: {
        scale: [1.28, 1.28, 1.25],
        offsetDelta: [0, -0.014, 0],
        profile: [[0, 1.1, 1.08], [0.38, 1.07, 1.06], [0.8, 1.02, 1.03], [1, 0.99, 1]],
      },
      pelvis: { scale: [1.16, 1.1, 1.16], offsetDelta: [0, -0.006, 0] },
    },
    extras: [
      {
        from: 'chest',
        id: 'baggyJacketLapel',
        shape: 'box',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.075, 0.62, 0.12],
        offsetDelta: [0.03, 0.006, 0.082],
        rotate: [0, 0, -14],
        mirror: true,
      },
    ],
  },
  {
    id: 'coat',
    name: 'ロングコート',
    override: {
      forearm: { uvSet: 'sleeve', scale: [1, 1.06, 1.06] },
      upperArm: { scale: [1, 1.07, 1.07] },
      shoulder: { scale: [1.06, 1.08, 1.08] },
      chest: { scale: [1.07, 1, 1.08] },
      abdomen: {
        scale: [1.1, 1.12, 1.09],
        offsetDelta: [0, -0.008, 0],
        profile: [[0, 1.06, 1.04], [0.42, 1.02, 1.02], [1, 0.97, 0.98]],
      },
    },
    extras: [
      {
        from: 'pelvis',
        id: 'coatSkirt',
        uvSet: 'torso',
        uvGroup: null,
        scale: [1.4, 4.2, 1.18],
        offsetDelta: [0, -0.19, 0],
        profile: [[0, 1.14, 1.08], [0.46, 1.08, 1.05], [0.82, 1, 1], [1, 0.94, 0.96]],
        omitFacings: ['pz'],
        omitFacingThreshold: 0.9,
      },
      {
        from: 'chest',
        id: 'coatLapel',
        shape: 'box',
        uvSet: 'clothShade',
        uvGroup: null,
        scale: [0.07, 0.52, 0.1],
        offsetDelta: [0.026, 0.006, 0.068],
        rotate: [0, 0, -12],
        mirror: true,
      },
    ],
  },
]

export const BOTTOMS = [
  {
    id: 'pants',
    name: '長ズボン',
    override: {
      thigh: {
        profile: [[0, 0.78, 0.8], [0.14, 0.86, 0.88], [0.58, 0.97, 0.97], [1, 1, 1]],
      },
      shin: {
        profile: [[0, 0.68, 0.72], [0.24, 0.78, 0.82], [0.58, 0.92, 0.94], [0.84, 0.9, 0.92], [1, 0.97, 0.97]],
      },
    },
  },
  {
    id: 'slimPants',
    name: '細身パンツ',
    override: {
      thigh: { scale: [0.96, 1, 0.96] },
      shin: {
        scale: [0.94, 1, 0.94],
        profile: [[0, 0.62, 0.66], [0.25, 0.75, 0.78], [0.58, 0.9, 0.92], [1, 0.96, 0.96]],
      },
    },
  },
  {
    id: 'cargo',
    name: 'カーゴパンツ',
    override: {
      pelvis: { scale: [1.08, 1.02, 1.08] },
      thigh: {
        scale: [1.14, 1, 1.14],
        profile: [[0, 0.82, 0.84], [0.18, 0.9, 0.92], [0.48, 1.06, 1.08], [0.7, 1.06, 1.08], [1, 1, 1]],
      },
      shin: {
        scale: [1.08, 1, 1.08],
        profile: [[0, 0.66, 0.7], [0.2, 0.82, 0.86], [0.55, 0.98, 1], [0.82, 0.94, 0.96], [1, 0.98, 0.98]],
      },
    },
  },
  {
    id: 'widePants',
    name: 'ワイドパンツ',
    override: {
      thigh: {
        scale: [1.18, 1, 1.18],
        profile: [[0, 0.94, 0.94], [0.2, 0.98, 0.98], [0.65, 1, 1], [1, 0.98, 0.98]],
      },
      shin: {
        scale: [1.2, 1, 1.2],
        profile: [[0, 0.9, 0.9], [0.2, 0.96, 0.96], [0.62, 1, 1], [1, 0.98, 0.98]],
      },
    },
  },
  {
    id: 'shorts',
    name: '半ズボン',
    override: {
      shin: { uvSet: 'skin' },
      thigh: { scale: [1.07, 1, 1.07] },
    },
  },
  {
    id: 'baggyShorts',
    name: 'ダボダボ半ズボン',
    override: {
      pelvis: { scale: [1.12, 1.04, 1.12] },
      thigh: {
        scale: [1.34, 1, 1.34],
        profile: [[0, 1.08, 1.06], [0.14, 1.16, 1.14], [0.58, 1.1, 1.1], [0.82, 1.02, 1.04], [1, 0.92, 0.94]],
      },
      shin: { uvSet: 'skin' },
    },
  },
  {
    id: 'miniSkirt',
    name: 'ミニスカート',
    override: {
      pelvis: {
        uvSet: 'legs',
        scale: [1.3, 1.8, 1.2],
        offsetDelta: [0, -0.049, 0],
        profile: [[0, 1.34, 1.26], [0.32, 1.2, 1.16], [1, 0.96, 0.98]],
      },
      thigh: { uvSet: 'skin' },
      shin: { uvSet: 'skin' },
    },
  },
  {
    id: 'longSkirt',
    name: 'ロングスカート',
    override: {
      pelvis: {
        uvSet: 'legs',
        scale: [1.35, 4.5, 1.22],
        offsetDelta: [0, -0.212, 0],
        profile: [[0, 1.32, 1.22], [0.42, 1.18, 1.14], [0.78, 1.05, 1.04], [1, 0.96, 0.98]],
      },
      thigh: { uvSet: 'skin' },
      shin: { uvSet: 'skin' },
    },
  },
]

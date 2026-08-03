/**
 * 服の種類。パーツのUV領域と形を差し替える定義。
 *
 * body.js の overrides に渡すと、パーツの uvSet / scale / offsetDelta / profile が
 * 差し替わる。形は絶対値ではなく倍率で指定する。size は身長比で体型ごとに違うため、
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
      chest: { scale: [0.97, 1, 0.97] },
    },
  },
  { id: 'tshirt', name: 'Tシャツ', override: {} },
  { id: 'longShirt', name: '長袖シャツ', override: { forearm: { uvSet: 'sleeve' } } },
  {
    id: 'hoodie',
    name: 'パーカー',
    override: {
      forearm: { uvSet: 'sleeve', scale: [1, 1.14, 1.14] },
      upperArm: { scale: [1, 1.12, 1.12] },
      chest: { scale: [1.1, 1, 1.12] },
      abdomen: { scale: [1.12, 1.1, 1.14] },
    },
  },
  {
    id: 'jacket',
    name: 'ジャケット',
    override: {
      forearm: { uvSet: 'sleeve', scale: [1, 1.07, 1.07] },
      upperArm: { scale: [1, 1.09, 1.09] },
      shoulder: { scale: [1.12, 1.14, 1.14] },
      chest: { scale: [1.08, 1, 1.09] },
      abdomen: { scale: [1.06, 1.12, 1.07], offsetDelta: [0, -0.008, 0] },
    },
  },
]

export const BOTTOMS = [
  { id: 'pants', name: '長ズボン', override: {} },
  {
    id: 'shorts',
    name: '半ズボン',
    override: {
      shin: { uvSet: 'skin' },
      thigh: { scale: [1.07, 1, 1.07] },
    },
  },
  {
    id: 'skirt',
    name: 'スカート',
    override: {
      // 骨盤を下へ伸ばして裾を広げ、スカートに見立てる
      pelvis: {
        uvSet: 'legs',
        scale: [1.28, 1.9, 1.28],
        offsetDelta: [0, -0.038, 0],
        profile: [[0, 1.32, 1.32], [0.45, 1.04, 1.04], [1, 0.96, 0.96]],
      },
      thigh: { uvSet: 'skin' },
      shin: { uvSet: 'skin' },
    },
  },
]

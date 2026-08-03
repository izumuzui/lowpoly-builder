import { createViewer } from './viewer.js'
import { createAtlas, region, paintSlot, setAtlasScale } from './atlas.js'
import { loadBodyList, loadBodySpec, buildBody } from './body.js'
import { decodeImage, detectFace, paintFace, paintFaceCrop, sampleSkinTone, shadeOf } from './face.js'
import { openCropper } from './cropper.js'
import { POSES, applyPose } from './poses.js'
import { TOPS, BOTTOMS } from './clothing.js'
import { applyLook, DEFAULT_LOOK } from './psx.js'
import { exportGLB, exportPNG, timestamp } from './exporter.js'

/**
 * 画像を貼れる枠。顔も服も同じ操作にそろえてある。
 * `preview` はタイルのサムネイルに映すアトラス領域。
 * `detect` が真の枠だけ、貼る前に顔検出を通す。
 */
const SLOTS = [
  { id: 'face', label: '顔', preview: 'face', detect: true, hint: '正面の写真' },
  { id: 'shirt', label: '服', preview: 'torsoFront', hint: '正面の写真' },
  // 服より後に並べる。この順で塗るため、背面・髪が服を上書きする
  { id: 'shirtBack', label: '服（背面）', preview: 'torsoBack', hint: '背面の写真' },
  { id: 'hair', label: '髪・後頭部', preview: 'headBack', hint: '背面の写真' },
  { id: 'pants', label: 'ズボン', preview: 'legs', hint: '写真から選ぶ' },
  { id: 'shoes', label: '靴', preview: 'shoe', hint: '写真から選ぶ' },
  // アトラスには入らない。背景として3Dシーンの奥に敷く
  { id: 'background', label: '背景', preview: null, hint: '画像から選ぶ' },
]

/** 背景の明暗。床の線の色も一緒に変わる。 */
const BACKDROPS = [
  { id: 'dark', name: '黒' },
  { id: 'light', name: '白' },
]

/** 顔と、それ以外で選べる方法が変わる。 */
const CROP_MODES = {
  face: [
    {
      id: 'auto',
      label: '自動',
      hint: '顔を検出して、目の位置に合わせて貼ります。',
      draw: false,
    },
    { id: 'rect', label: '矩形', hint: '囲った範囲をそのまま顔に貼ります。' },
  ],
  default: [
    { id: 'rect', label: '矩形', hint: '囲った範囲を全体に敷きます。生地や柄向き。' },
    { id: 'free', label: 'フリーハンド', hint: '囲った形だけを貼ります。ロゴやワッペン向き。' },
  ],
}

const el = {
  stage: document.querySelector('.stage'),
  status: document.getElementById('status'),
  slotList: document.getElementById('slot-list'),
  slotNote: document.getElementById('slot-note'),
  slotInput: document.getElementById('slot-input'),
  bodyList: document.getElementById('body-list'),
  poseList: document.getElementById('pose-list'),
  topList: document.getElementById('top-list'),
  bottomList: document.getElementById('bottom-list'),
  backdropList: document.getElementById('backdrop-list'),
  lookJitter: document.getElementById('look-jitter'),
  lookAffine: document.getElementById('look-affine'),
  lookUnlit: document.getElementById('look-unlit'),
  lookDetail: document.getElementById('look-detail'),
  lookScale: document.getElementById('look-scale'),
  lookTexture: document.getElementById('look-texture'),
  exportGlb: document.getElementById('export-glb'),
  exportPng: document.getElementById('export-png'),
  pngTransparent: document.getElementById('png-transparent'),
}

const state = {
  viewer: null,
  bodies: [],
  spec: null,
  atlas: null,
  mesh: null,
  /** 枠ID → { image, source, selection, detection?, fit? }。体型を切り替えても保持して貼り直す。 */
  slots: {},
  look: { ...DEFAULT_LOOK },
  detail: 'normal',
  pose: 'tpose',
  top: 'tshirt',
  bottom: 'pants',
  backdrop: 'dark',
  /** アトラスの倍率。実写を貼るときは上げないと情報が足りない */
  atlasScale: 1,
}

function setStatus(message, tone = 'info') {
  el.status.textContent = message
  el.status.dataset.tone = tone
}

/* ---------- モデルの組み立て ---------- */

function rebuild({ reframe = false } = {}) {
  setAtlasScale(state.atlasScale)

  // 顔写真から拾った肌の色を下地に使う。パレット固定だと顔の輪郭に色の違う縁が出る
  const tone = state.slots.face?.skinTone
  const palette = tone
    ? { ...state.spec.palette, skin: shadeOf(tone, 1), skinShade: shadeOf(tone, 0.82) }
    : state.spec.palette
  state.atlas = createAtlas(palette)

  for (const slot of SLOTS) {
    const filled = state.slots[slot.id]
    if (!filled) continue
    if (slot.id === 'background') continue
    if (!slot.detect) {
      paintSlot(state.atlas, slot.id, filled.image, { fit: filled.fit })
    } else if (filled.selection?.mode === 'auto') {
      paintFace(state.atlas, filled.image, filled.detection)
    } else {
      // 矩形で選んだ場合は位置合わせをせず、そのまま顔領域へ
      paintFaceCrop(state.atlas, filled.image)
    }
  }

  // 上下は別のパーツを触るため、そのまま重ねてよい
  const top = TOPS.find((t) => t.id === state.top)
  const bottom = BOTTOMS.find((b) => b.id === state.bottom)
  state.mesh = buildBody(state.spec, state.atlas, {
    detail: state.detail,
    overrides: { ...top?.override, ...bottom?.override },
  })
  applyLook(state.mesh, state.look)
  applyPose(state.mesh, state.pose)
  state.viewer.setModel(state.mesh)
  state.viewer.setBackdrop(state.backdrop)
  state.viewer.setBackgroundImage(state.slots.background?.image ?? null)
  if (reframe) state.viewer.frame(state.mesh)

  drawSlotPreviews()
}

function reportModel() {
  const triangles = state.mesh.geometry.attributes.position.count / 3
  setStatus(
    `${state.spec.name} / ${POSES[state.pose].name} / ${triangles}ポリゴン / 身長${state.spec.height}m`,
  )
}

/* ---------- 画像スロット ---------- */

let pendingSlot = null

function renderSlots() {
  el.slotList.replaceChildren(
    ...SLOTS.map((slot) => {
      const item = document.createElement('li')
      item.className = 'slot'
      item.dataset.slot = slot.id
      item.dataset.filled = String(Boolean(state.slots[slot.id]))

      const pick = document.createElement('button')
      pick.type = 'button'
      pick.className = 'slot__pick'

      const preview = document.createElement('canvas')
      preview.className = 'slot__preview'
      preview.width = 48
      preview.height = 48
      preview.dataset.slot = slot.id
      if (slot.preview) preview.dataset.region = slot.preview

      const text = document.createElement('span')
      text.className = 'slot__text'
      const label = document.createElement('span')
      label.className = 'slot__label'
      label.textContent = slot.label
      const stateText = document.createElement('span')
      stateText.className = 'slot__state'
      stateText.textContent = state.slots[slot.id] ? '画像あり' : slot.hint
      text.append(label, stateText)

      pick.append(preview, text)
      pick.addEventListener('click', () => openSlot(slot.id))
      item.append(pick)

      const clear = document.createElement('button')
      clear.type = 'button'
      clear.className = 'slot__clear'
      clear.textContent = '×'
      clear.setAttribute('aria-label', `${slot.label}の画像を外す`)
      clear.addEventListener('click', () => clearSlot(slot.id))
      item.append(clear)

      attachDropTarget(item, slot.id)
      return item
    }),
  )
  drawSlotPreviews()
}

/** タイルのサムネイルへ、実際のアトラスの中身を映す。 */
function drawSlotPreviews() {
  for (const canvas of el.slotList.querySelectorAll('.slot__preview')) {
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 背景はアトラスに入らないので、貼った画像そのものを映す
    if (!canvas.dataset.region) {
      const image = state.slots[canvas.dataset.slot]?.image
      if (!image) continue
      const cover = Math.max(canvas.width / image.width, canvas.height / image.height)
      const dw = image.width * cover
      const dh = image.height * cover
      ctx.drawImage(image, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh)
      continue
    }

    const [x, y, w, h] = region(canvas.dataset.region)

    // 縦横比を保ったまま正方形いっぱいに収める（はみ出す側を切る）
    const scale = Math.max(canvas.width / w, canvas.height / h)
    const sw = canvas.width / scale
    const sh = canvas.height / scale
    ctx.drawImage(
      state.atlas.canvas,
      x + (w - sw) / 2,
      y + (h - sh) / 2,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  }
}

/**
 * 枠をひらく。既に画像がある枠は、同じ元画像のまま選び直せる。
 */
function openSlot(slotId) {
  const existing = state.slots[slotId]
  if (existing?.source) {
    runCropper(slotId, existing.source, existing.selection, existing.detection ?? null)
    return
  }
  pendingSlot = slotId
  el.slotInput.click()
}

async function runCropper(slotId, source, initial, detection) {
  const slot = SLOTS.find((s) => s.id === slotId)
  const modes = (CROP_MODES[slotId] ?? CROP_MODES.default).map((mode) =>
    // 顔が見つからなければ自動は選べない
    mode.id === 'auto' && !detection
      ? { ...mode, disabled: true, hint: '顔を検出できませんでした' }
      : mode,
  )

  const result = await openCropper({ image: source, label: slot.label, modes, initial, detection })
  if (!result) return

  if (result.replace) {
    pendingSlot = slotId
    el.slotInput.click()
    return
  }

  // 元画像は選び直しのために持ち続ける。差し替え時だけ古いものを解放する
  const previous = state.slots[slotId]
  if (previous && previous.source !== source) previous.source?.close?.()

  const image = result.mode === 'auto' ? source : result.canvas
  state.slots[slotId] = {
    image,
    fit: result.fit,
    source,
    selection: result.selection,
    // 検出結果は元画像の性質なので、どのモードを選んでも持ち続ける。
    // 捨てると開き直したときに自動へ戻せなくなる
    detection,
    // 顔の下地に使う肌の色。自動なら検出位置から、矩形なら切り出しの中央から拾う
    skinTone: slotId === 'face'
      ? sampleSkinTone(image, result.mode === 'auto' ? detection : null)
      : undefined,
  }

  rebuild()
  renderSlots()
  const label = { auto: '自動', rect: '矩形', free: 'フリーハンド' }[result.mode]
  setStatus(`${slot.label}に貼りました (${label})`)
}

async function applyToSlot(slotId, file) {
  const slot = SLOTS.find((s) => s.id === slotId)
  if (!slot) return
  if (!file || !file.type.startsWith('image/')) {
    setStatus('画像ファイルを選んでください', 'error')
    return
  }

  setStatus(slot.detect ? '顔を検出しています' : '画像を読み込んでいます')
  try {
    const image = await decodeImage(file)
    // 顔の枠は先に検出しておき、自動モードが選べるかを範囲選択画面へ渡す
    const detection = slot.detect ? await detectFace(image) : null
    await runCropper(slotId, image, null, detection)
  } catch (error) {
    console.error(error)
    setStatus(`画像の処理に失敗しました: ${error.message}`, 'error')
  }
}

function clearSlot(slotId) {
  const filled = state.slots[slotId]
  filled?.image?.close?.()
  if (filled?.source !== filled?.image) filled?.source?.close?.()
  delete state.slots[slotId]
  rebuild()
  renderSlots()
  reportModel()
}

/** ドラッグ&ドロップの受け口。タイルにもステージにも同じ挙動をつける。 */
function attachDropTarget(element, slotId) {
  let depth = 0
  element.addEventListener('dragenter', (event) => {
    event.preventDefault()
    depth += 1
    element.dataset.dragover = 'true'
  })
  element.addEventListener('dragover', (event) => event.preventDefault())
  element.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) delete element.dataset.dragover
  })
  element.addEventListener('drop', (event) => {
    event.preventDefault()
    event.stopPropagation()
    depth = 0
    delete element.dataset.dragover
    applyToSlot(slotId, event.dataTransfer?.files?.[0])
  })
}

function wireSlots() {
  renderSlots()
  // ステージへ落とした場合は顔として扱う
  attachDropTarget(el.stage, 'face')
  el.slotInput.addEventListener('change', () => {
    const file = el.slotInput.files?.[0]
    el.slotInput.value = ''
    if (pendingSlot) applyToSlot(pendingSlot, file)
    pendingSlot = null
  })
}

/* ---------- チップ（体型・ポーズ） ---------- */

function renderChips(list, entries, currentId, onSelect) {
  list.replaceChildren(
    ...entries.map(({ id, name }) => {
      const item = document.createElement('li')
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'chip'
      chip.setAttribute('role', 'radio')
      chip.setAttribute('aria-checked', String(id === currentId))
      chip.textContent = name
      chip.addEventListener('click', () => onSelect(id))
      item.append(chip)
      return item
    }),
  )
}

function renderBodyChips() {
  renderChips(el.bodyList, state.bodies, state.spec?.id, selectBody)
}

function renderPoseChips() {
  const entries = Object.entries(POSES).map(([id, pose]) => ({ id, name: pose.name }))
  renderChips(el.poseList, entries, state.pose, (id) => {
    state.pose = id
    // ジオメトリは作り直さずボーンだけ動かす
    applyPose(state.mesh, state.pose)
    renderPoseChips()
    reportModel()
  })
}

function renderBackdropChips() {
  renderChips(el.backdropList, BACKDROPS, state.backdrop, (id) => {
    state.backdrop = id
    state.viewer.setBackdrop(id)
    renderBackdropChips()
  })
}

function renderClothingChips() {
  // UV領域と形の両方が変わるため、どちらもジオメトリから作り直す
  renderChips(el.topList, TOPS, state.top, (id) => {
    state.top = id
    rebuild()
    renderClothingChips()
    reportModel()
  })
  renderChips(el.bottomList, BOTTOMS, state.bottom, (id) => {
    state.bottom = id
    rebuild()
    renderClothingChips()
    reportModel()
  })
}

async function selectBody(id) {
  if (state.spec?.id === id) return
  try {
    state.spec = await loadBodySpec(id)
    renderBodyChips()
    rebuild({ reframe: true })
    reportModel()
  } catch (error) {
    console.error(error)
    setStatus(`体型の生成に失敗しました: ${error.message}`, 'error')
  }
}

/* ---------- 見た目 ---------- */

function wireLook() {
  const sync = () => {
    state.look.jitter = el.lookJitter.checked
    state.look.affine = el.lookAffine.checked
    state.look.unlit = el.lookUnlit.checked
    applyLook(state.mesh, state.look)
  }

  el.lookJitter.checked = state.look.jitter
  el.lookAffine.checked = state.look.affine
  el.lookUnlit.checked = state.look.unlit
  el.lookDetail.value = state.detail
  el.lookScale.value = String(state.look.renderScale)

  for (const input of [el.lookJitter, el.lookAffine, el.lookUnlit]) {
    input.addEventListener('change', sync)
  }

  el.lookScale.addEventListener('change', () => {
    state.look.renderScale = Number(el.lookScale.value)
    state.viewer.setRenderScale(state.look.renderScale)
  })

  el.lookDetail.addEventListener('change', () => {
    state.detail = el.lookDetail.value
    rebuild()
    reportModel()
  })

  el.lookTexture.value = String(state.atlasScale)
  el.lookTexture.addEventListener('change', () => {
    state.atlasScale = Number(el.lookTexture.value)
    // アトラスの大きさが変わるので作り直す。貼ってある画像は貼り直される
    rebuild()
    setStatus(`テクスチャを ${256 * state.atlasScale}px にしました`)
  })
}

/* ---------- 書き出し ---------- */

function wireExport() {
  el.exportGlb.addEventListener('click', async () => {
    if (!state.mesh) return
    el.exportGlb.disabled = true
    setStatus('.glb を書き出しています')
    try {
      const bytes = await exportGLB(state.mesh, `${state.spec.id}-${timestamp()}.glb`)
      setStatus(`.glb を書き出しました (${formatBytes(bytes)})`)
    } catch (error) {
      console.error(error)
      setStatus(`書き出しに失敗しました: ${error.message}`, 'error')
    } finally {
      el.exportGlb.disabled = false
    }
  })

  el.exportPng.addEventListener('click', async () => {
    if (!state.mesh) return
    el.exportPng.disabled = true
    try {
      const bytes = await exportPNG(state.viewer, {
        transparent: el.pngTransparent.checked,
        filename: `${state.spec.id}-${timestamp()}.png`,
      })
      setStatus(`.png を書き出しました (${formatBytes(bytes)})`)
    } catch (error) {
      console.error(error)
      setStatus(`書き出しに失敗しました: ${error.message}`, 'error')
    } finally {
      el.exportPng.disabled = false
    }
  })
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/* ---------- 起動 ---------- */

async function main() {
  state.viewer = createViewer(document.getElementById('viewport'))
  wireExport()

  const list = await loadBodyList()
  state.bodies = list.bodies
  await selectBody(state.bodies[0].id)

  // メッシュができてから、それに触る操作系をつなぐ
  wireSlots()
  renderPoseChips()
  renderClothingChips()
  renderBackdropChips()
  wireLook()
  state.viewer.setRenderScale(state.look.renderScale)
  reportModel()
}

main().catch((error) => {
  console.error(error)
  setStatus(`初期化に失敗しました: ${error.message}`, 'error')
})

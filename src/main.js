import { createViewer } from './viewer.js'
import { createAtlas, region, paintSlot, setAtlasScale } from './atlas.js'
import { loadBodyList, loadBodySpec, buildBody } from './body.js'
import { decodeImage, detectFace, paintFace, paintFaceCrop, sampleSkinTone, shadeOf } from './face.js?v=20260805-14'
import { applyPhotoPose, detectPhotoPose } from './photo-pose.js?v=20260805-14'
import { createAutomaticTextureParts, segmentPerson } from './auto-texture.js?v=20260805-14'
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

const DETECTED_POSE_ID = 'detectedPose'

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
  app: document.querySelector('.app'),
  stage: document.querySelector('.stage'),
  panel: document.getElementById('settings-panel'),
  panelToggle: document.getElementById('panel-toggle'),
  status: document.getElementById('status'),
  sourceList: document.getElementById('source-list'),
  sourceNote: document.getElementById('source-note'),
  sourceAdd: document.getElementById('source-add'),
  sourceInput: document.getElementById('source-input'),
  autoTextureApply: document.getElementById('auto-texture-apply'),
  autoTextureNote: document.getElementById('auto-texture-note'),
  photoPoseApply: document.getElementById('photo-pose-apply'),
  photoPoseNote: document.getElementById('photo-pose-note'),
  slotList: document.getElementById('slot-list'),
  slotNote: document.getElementById('slot-note'),
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
  /** 取り込んだ元画像。同じ素材を複数の部位から参照できる。 */
  sources: [],
  activeSourceId: null,
  /** 枠ID → { image, sourceId, selection, detection?, fit? }。体型を切り替えても保持する。 */
  slots: {},
  look: { ...DEFAULT_LOOK },
  detail: 'normal',
  pose: 'tpose',
  detectedPose: null,
  poseBusy: false,
  textureBusy: false,
  top: 'tshirt',
  bottom: 'pants',
  backdrop: 'dark',
  /** アトラスの倍率。実写を貼るときは上げないと情報が足りない */
  atlasScale: 1,
}

let sourceSequence = 0

function setStatus(message, tone = 'info') {
  el.status.textContent = message
  el.status.dataset.tone = tone
}

function wirePanelToggle() {
  const setCollapsed = (collapsed) => {
    el.app.classList.toggle('app--panel-collapsed', collapsed)
    el.panel.classList.toggle('panel--collapsed', collapsed)
    el.panelToggle.setAttribute('aria-expanded', String(!collapsed))
    el.panelToggle.textContent = collapsed ? '設定を開く' : '設定を閉じる'
  }

  el.panelToggle.addEventListener('click', () => {
    setCollapsed(!el.panel.classList.contains('panel--collapsed'))
  })
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

  // 同じパーツを上下の服が触る場合も、プロパティ単位で合成する
  const top = TOPS.find((t) => t.id === state.top)
  const bottom = BOTTOMS.find((b) => b.id === state.bottom)
  state.mesh = buildBody(state.spec, state.atlas, {
    detail: state.detail,
    overrides: mergeOverrides(top?.override, bottom?.override),
    extras: [...(top?.extras ?? []), ...(bottom?.extras ?? [])],
  })
  applyLook(state.mesh, state.look)
  applyCurrentPose()
  state.viewer.setModel(state.mesh)
  state.viewer.setBackdrop(state.backdrop)
  state.viewer.setBackgroundImage(state.slots.background?.image ?? null)
  if (reframe) state.viewer.frame(state.mesh)

  drawSlotPreviews()
}

function mergeOverrides(...groups) {
  const merged = {}
  for (const group of groups) {
    for (const [part, override] of Object.entries(group ?? {})) {
      merged[part] = { ...merged[part], ...override }
    }
  }
  return merged
}

function reportModel() {
  const triangles = state.mesh.geometry.attributes.position.count / 3
  const poseName = state.pose === DETECTED_POSE_ID
    ? '写真から読み取り'
    : (POSES[state.pose] ?? POSES.tpose).name
  setStatus(
    `${state.spec.name} / ${poseName} / ${triangles}ポリゴン / 身長${state.spec.height}m`,
  )
}

function applyCurrentPose() {
  if (state.pose === DETECTED_POSE_ID && state.detectedPose) {
    return applyPhotoPose(state.mesh, state.detectedPose)
  }
  applyPose(state.mesh, state.pose)
  return null
}

/* ---------- 画像スロット ---------- */

let pendingSlot = null

function sourceById(id) {
  return state.sources.find((source) => source.id === id) ?? null
}

function activeSource() {
  return sourceById(state.activeSourceId)
}

function renderSources() {
  el.sourceList.replaceChildren(
    ...state.sources.map((source) => {
      const item = document.createElement('li')
      item.className = 'source'

      const pick = document.createElement('button')
      pick.type = 'button'
      pick.className = 'source__pick'
      pick.setAttribute('aria-pressed', String(source.id === state.activeSourceId))
      pick.setAttribute('aria-label', `${source.name}を素材として選ぶ`)

      const preview = document.createElement('canvas')
      preview.className = 'source__preview'
      preview.width = 72
      preview.height = 72
      preview.dataset.source = source.id

      const name = document.createElement('span')
      name.className = 'source__name'
      name.textContent = source.name
      name.title = source.name
      pick.append(preview, name)
      pick.addEventListener('click', () => selectSource(source.id))
      item.append(pick)

      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'source__remove'
      remove.textContent = '×'
      remove.setAttribute('aria-label', `${source.name}を素材一覧から外す`)
      remove.addEventListener('click', () => removeSource(source.id))
      item.append(remove)
      return item
    }),
  )

  const selected = activeSource()
  const imageBusy = state.poseBusy || state.textureBusy
  const selectedPoseApplied = state.pose === DETECTED_POSE_ID
    && state.detectedPose?.sourceId === selected?.id
  el.sourceNote.textContent = selected
    ? `選択中: ${selected.name}`
    : '1枚でも複数でもまとめて追加できます。'
  el.slotNote.textContent = selected
    ? `「${selected.name}」から切り出す部位を選んでください。`
    : '素材画像を選んでから、切り出す部位を選んでください。'
  el.autoTextureApply.disabled = !selected || imageBusy
  el.autoTextureApply.textContent = state.textureBusy
    ? '人物を分けて貼り付け中…'
    : selected?.textureAnalysis
      ? 'この写真を自動で貼り直す'
      : 'この写真を自動で貼り付け'
  el.autoTextureNote.textContent = selected?.textureAnalysis
    ? `${selected.textureAnalysis.facing === 'front' ? '正面' : '背面'}写真として、${selected.textureAnalysis.labels.join('・')}へ貼り付け済みです。`
    : '人物を顔・髪・服・下半身・靴へ分け、対応する場所へまとめて貼ります。'
  el.photoPoseApply.disabled = !selected || imageBusy
  el.photoPoseApply.textContent = state.poseBusy
    ? '3D姿勢を読み取り中…'
    : selectedPoseApplied
      ? 'この写真のポーズを再反映'
      : selected?.poseDetection
        ? '検出済みのポーズを反映'
      : '選択中の写真からポーズを反映'
  el.photoPoseNote.textContent = selected?.poseDetection
    ? `「${selected.name}」から${selected.poseDetection.visibleLandmarks}点を検出済みです。`
    : '全身が写った写真を選ぶと、端末内のCPUで3D姿勢を読み取れます。'
  drawSourcePreviews()
}

function drawSourcePreviews() {
  for (const canvas of el.sourceList.querySelectorAll('.source__preview')) {
    const source = sourceById(canvas.dataset.source)
    if (!source) continue
    const ctx = canvas.getContext('2d')
    const scale = Math.max(canvas.width / source.image.width, canvas.height / source.image.height)
    const width = source.image.width * scale
    const height = source.image.height * scale
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source.image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
  }
}

function selectSource(id) {
  state.activeSourceId = id
  renderSources()
  renderSlots()
}

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
      const filled = state.slots[slot.id]
      const sourceName = sourceById(filled?.sourceId)?.name ?? '画像あり'
      stateText.textContent = filled
        ? `${filled.automatic ? '自動: ' : ''}${sourceName}`
        : slot.hint
      text.append(label, stateText)

      pick.append(preview, text)
      pick.addEventListener('click', () => void openSlot(slot.id))
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
 * 選択中の素材から枠を切り出す。同じ素材なら前回の矩形を保ったまま微調整できる。
 */
async function openSlot(slotId) {
  const existing = state.slots[slotId]
  let source = activeSource()
  if (!source && existing) {
    source = sourceById(existing.sourceId)
  }

  if (!source) {
    pendingSlot = slotId
    el.sourceInput.click()
    return
  }

  const initial = existing?.sourceId === source.id ? existing.selection : null
  try {
    await runCropper(slotId, source, initial)
  } catch (error) {
    console.error(error)
    setStatus(`画像の処理に失敗しました: ${error.message}`, 'error')
  }
}

async function runCropper(slotId, source, initial) {
  const slot = SLOTS.find((s) => s.id === slotId)
  if (!slot) return

  if (slot.detect && source.detection === undefined) {
    setStatus('顔を検出しています')
    try {
      source.detection = await detectFace(source.image)
    } catch (error) {
      console.warn('顔検出を省略します', error)
      source.detection = null
    }
  }
  const detection = slot.detect ? source.detection : null
  const modes = (CROP_MODES[slotId] ?? CROP_MODES.default).map((mode) =>
    // 顔が見つからなければ自動は選べない
    mode.id === 'auto' && !detection
      ? { ...mode, disabled: true, hint: '顔を検出できませんでした' }
      : mode,
  )

  const result = await openCropper({ image: source.image, label: slot.label, modes, initial, detection })
  if (!result) {
    reportModel()
    return
  }

  if (result.replace) {
    pendingSlot = slotId
    el.sourceInput.click()
    return
  }

  const previous = state.slots[slotId]
  const previousSource = sourceById(previous?.sourceId)
  if (previous?.image && previous.image !== previousSource?.image) previous.image.close?.()

  const image = result.mode === 'auto' ? source.image : result.canvas
  state.slots[slotId] = {
    image,
    fit: result.fit,
    sourceId: source.id,
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

async function addSourceFiles(files) {
  const images = [...files].filter((file) => file?.type.startsWith('image/'))
  if (!images.length) {
    setStatus('画像ファイルを選んでください', 'error')
    return []
  }

  setStatus(`${images.length}枚の画像を読み込んでいます`)
  const added = []
  for (const file of images) {
    try {
      const image = await decodeImage(file)
      const source = {
        id: `source-${++sourceSequence}`,
        name: file.name || `素材${sourceSequence}`,
        image,
        // undefined は未検出、null は検出を試したが見つからなかった状態
        detection: undefined,
        poseDetection: undefined,
        segmentation: undefined,
        textureAnalysis: null,
      }
      state.sources.push(source)
      added.push(source)
    } catch (error) {
      console.error(error)
      setStatus(`画像の処理に失敗しました: ${error.message}`, 'error')
    }
  }

  if (added.length) {
    state.activeSourceId = added[0].id
    renderSources()
    renderSlots()
    setStatus(`${added.length}枚の素材画像を追加しました`)
  }
  return added
}

async function importForSlot(slotId, files) {
  const added = await addSourceFiles(files)
  if (!added.length) return
  state.activeSourceId = added[0].id
  await openSlot(slotId)
}

function releaseSlot(slotId) {
  const filled = state.slots[slotId]
  if (!filled) return
  const source = sourceById(filled.sourceId)
  if (filled.image !== source?.image) filled.image?.close?.()
  delete state.slots[slotId]
}

function clearSlot(slotId) {
  releaseSlot(slotId)
  rebuild()
  renderSlots()
  reportModel()
}

function removeSource(id) {
  const source = sourceById(id)
  if (!source) return
  const usedBy = Object.entries(state.slots)
    .filter(([, filled]) => filled.sourceId === id)
    .map(([slotId]) => slotId)

  if (usedBy.length && !window.confirm('この素材を使っている貼り付けも外します。よろしいですか？')) {
    return
  }

  usedBy.forEach(releaseSlot)
  if (state.detectedPose?.sourceId === id) {
    state.detectedPose = null
    if (state.pose === DETECTED_POSE_ID) state.pose = 'tpose'
  }
  source.image.close?.()
  state.sources = state.sources.filter((item) => item.id !== id)
  if (state.activeSourceId === id) state.activeSourceId = state.sources[0]?.id ?? null
  rebuild()
  renderSources()
  renderSlots()
  renderPoseChips()
  reportModel()
}

async function applyPoseFromActiveSource() {
  const source = activeSource()
  if (!source || state.poseBusy) return

  state.poseBusy = true
  renderSources()
  setStatus('写真から3D姿勢を読み取っています')
  try {
    source.poseDetection ??= await detectPhotoPose(source.image)
    state.detectedPose = { ...source.poseDetection, sourceId: source.id }
    state.pose = DETECTED_POSE_ID
    const applied = applyCurrentPose()
    renderPoseChips()
    state.viewer.frame(state.mesh)
    const confidence = Math.round(source.poseDetection.confidence * 100)
    setStatus(`写真の3D姿勢を反映しました (${applied.appliedBones}ボーン / 信頼度${confidence}%)`)
  } catch (error) {
    console.error(error)
    setStatus(`姿勢を読み取れませんでした: ${error.message}`, 'error')
  } finally {
    state.poseBusy = false
    renderSources()
  }
}

/** 選択中の写真を人物領域へ分け、検出できた各スロットへまとめて貼る。 */
async function applyAutomaticTextureFromActiveSource() {
  const source = activeSource()
  if (!source || state.textureBusy || state.poseBusy) return

  state.textureBusy = true
  renderSources()
  setStatus('写真の人物を顔・髪・服へ分けています')
  try {
    source.segmentation ??= await segmentPerson(source.image)
    if (source.detection === undefined) {
      try {
        source.detection = await detectFace(source.image)
      } catch (error) {
        console.warn('顔検出を省略します', error)
        source.detection = null
      }
    }
    if (source.poseDetection === undefined) {
      try {
        source.poseDetection = await detectPhotoPose(source.image)
      } catch (error) {
        console.warn('部位分割では姿勢点を省略します', error)
        source.poseDetection = null
      }
    }

    const analysis = createAutomaticTextureParts(source.image, source.segmentation, {
      poseDetection: source.poseDetection,
      faceDetection: source.detection,
    })
    if (!source.detection && analysis.parts.face?.sourceDetection) {
      // 顔専用検出が失敗した写真でも、姿勢点または顔マスクの補完結果を手動調整で再利用する。
      source.detection = analysis.parts.face.sourceDetection
    }
    const assignments = analysis.facing === 'front'
      ? [
          ['face', 'face'],
          ['hair', 'hair'],
          ['shirt', 'shirt'],
          ['pants', 'pants'],
          ['shoes', 'shoes'],
        ]
      : [
          ['hair', 'hair'],
          ['shirtBack', 'shirt'],
        ]
    const applied = []

    for (const [slotId, partId] of assignments) {
      const part = analysis.parts[partId]
      if (!part) continue
      releaseSlot(slotId)
      const slot = SLOTS.find((item) => item.id === slotId)
      state.slots[slotId] = {
        image: part.canvas,
        fit: 'cover',
        sourceId: source.id,
        selection: part.selection,
        detection: slot?.detect ? part.detection : null,
        skinTone: slotId === 'face'
          ? sampleSkinTone(source.image, part.sourceDetection ?? source.detection)
          : undefined,
        automatic: true,
      }
      applied.push({ id: slotId, label: slot?.label ?? slotId })
    }

    if (!applied.length) throw new Error('モデルへ貼れる人物領域が見つかりませんでした')
    if (state.atlasScale < 2) {
      state.atlasScale = 2
      el.lookTexture.value = '2'
    }
    source.textureAnalysis = {
      facing: analysis.facing,
      slots: applied.map((item) => item.id),
      labels: applied.map((item) => item.label),
    }
    rebuild({ reframe: true })
    renderSlots()
    const direction = analysis.facing === 'front' ? '正面' : '背面'
    setStatus(`${direction}写真から${applied.length}部位を自動で貼り付けました`)
  } catch (error) {
    console.error(error)
    setStatus(`自動貼り付けに失敗しました: ${error.message}`, 'error')
  } finally {
    state.textureBusy = false
    renderSources()
  }
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
    void importForSlot(slotId, event.dataTransfer?.files ?? [])
  })
}

function wireSlots() {
  renderSources()
  renderSlots()
  // ステージへ落とした場合は顔として扱う
  attachDropTarget(el.stage, 'face')
  el.sourceAdd.addEventListener('click', () => {
    pendingSlot = null
    el.sourceInput.click()
  })
  el.autoTextureApply.addEventListener('click', () => void applyAutomaticTextureFromActiveSource())
  el.photoPoseApply.addEventListener('click', () => void applyPoseFromActiveSource())
  el.sourceInput.addEventListener('change', async () => {
    const files = [...(el.sourceInput.files ?? [])]
    const target = pendingSlot
    el.sourceInput.value = ''
    pendingSlot = null
    const added = await addSourceFiles(files)
    if (target && added.length) {
      state.activeSourceId = added[0].id
      await openSlot(target)
    }
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
  if (state.detectedPose) entries.push({ id: DETECTED_POSE_ID, name: '写真から読み取り' })
  renderChips(el.poseList, entries, state.pose, (id) => {
    state.pose = id
    // ジオメトリは作り直さずボーンだけ動かす
    applyCurrentPose()
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
  wirePanelToggle()
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

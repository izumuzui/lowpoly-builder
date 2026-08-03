/**
 * 画像から貼りたい範囲を選ぶ画面。
 *
 * 選び方によって意味を変えている。
 * - 矩形 … 「この範囲を使う」。切り出した矩形を領域いっぱいに敷く
 * - フリーハンド … 「この形を貼る」。囲った形の外は透明にし、下地の色を透かす
 * - 自動 … 囲わない。顔だけで使い、目の位置に合わせて貼る
 *
 * どのモードを出すかは呼び出し側が決める。返り値には選択のやり直し用に
 * 選択状態そのものを含める。
 */

/** 書き出すcanvasの最大辺。アトラスは256pxなのでこれ以上は無駄になる。 */
const MAX_OUTPUT = 512

/**
 * @param {object} options
 * @param {Array<{id: string, label: string, hint: string, draw?: boolean, disabled?: boolean}>} options.modes
 *   `draw: false` のモードは範囲を囲わない（決定が常に押せる）
 * @param {{eyes: Array<{x: number, y: number}>}|null} [options.detection] 顔検出の結果。自動モードの目印に使う
 * @returns {Promise<object|null>} やめた場合は null。別の画像を選び直した場合は { replace: true }
 */
export function openCropper({ image, label, modes, initial = null, detection = null }) {
  return new Promise((resolve) => {
    const available = modes.filter((mode) => !mode.disabled)
    const root = document.createElement('div')
    root.className = 'cropper'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-modal', 'true')
    root.setAttribute('aria-label', `${label}の範囲を選ぶ`)

    root.innerHTML = `
      <div class="cropper__head">
        <h2 class="cropper__title">${label}にする範囲を選ぶ</h2>
        <ul class="chips" role="radiogroup" aria-label="選択の方法">
          ${modes
            .map(
              (mode) =>
                `<li><button type="button" class="chip" role="radio" data-mode="${mode.id}"${
                  mode.disabled ? ' disabled' : ''
                }>${mode.label}</button></li>`,
            )
            .join('')}
        </ul>
      </div>
      <div class="cropper__stage"><canvas class="cropper__canvas"></canvas></div>
      <p class="cropper__hint"></p>
      <div class="cropper__foot">
        <button type="button" class="button" data-act="replace">別の画像</button>
        <button type="button" class="button" data-act="cancel">やめる</button>
        <button type="button" class="button button--primary" data-act="apply">決定</button>
      </div>
    `

    const canvas = root.querySelector('.cropper__canvas')
    const stage = root.querySelector('.cropper__stage')
    const hint = root.querySelector('.cropper__hint')
    const ctx = canvas.getContext('2d')

    const byId = (id) => modes.find((mode) => mode.id === id)
    const initialMode =
      initial?.mode && byId(initial.mode) && !byId(initial.mode).disabled
        ? initial.mode
        : available[0]?.id

    const state = {
      mode: initialMode,
      rect: initial?.rect ?? null,
      path: initial?.path ?? null,
      drawing: false,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }

    /** 範囲を囲うモードかどうか。自動モードは囲わない。 */
    const needsShape = () => byId(state.mode)?.draw !== false

    /* ---------- 表示 ---------- */

    function layout() {
      const box = stage.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      const ratio = Math.min(window.devicePixelRatio, 2)
      canvas.width = Math.round(box.width * ratio)
      canvas.height = Math.round(box.height * ratio)
      canvas.style.width = `${box.width}px`
      canvas.style.height = `${box.height}px`

      state.scale = Math.min(canvas.width / image.width, canvas.height / image.height)
      state.offsetX = (canvas.width - image.width * state.scale) / 2
      state.offsetY = (canvas.height - image.height * state.scale) / 2
      draw()
    }

    function shapePath(target) {
      target.beginPath()
      if (state.mode === 'rect' && state.rect) {
        const { x, y, w, h } = state.rect
        target.rect(x, y, w, h)
      } else if (state.mode === 'free' && state.path?.length > 2) {
        target.moveTo(state.path[0].x, state.path[0].y)
        for (const point of state.path.slice(1)) target.lineTo(point.x, point.y)
        target.closePath()
      }
    }

    function hasSelection() {
      if (!needsShape()) return false
      return state.mode === 'rect'
        ? Boolean(state.rect && Math.abs(state.rect.w) > 4 && Math.abs(state.rect.h) > 4)
        : Boolean(state.path && state.path.length > 2)
    }

    /** 囲わないモードは最初から決定できる。 */
    function canApply() {
      return !needsShape() || hasSelection()
    }

    /** 自動モードで、検出された目の位置に印を出す。 */
    function drawEyeMarks() {
      if (!detection?.eyes) return
      ctx.save()
      ctx.strokeStyle = '#d9a441'
      ctx.lineWidth = Math.max(2, 2 * Math.min(window.devicePixelRatio, 2))
      for (const eye of detection.eyes) {
        const x = state.offsetX + eye.x * state.scale
        const y = state.offsetY + eye.y * state.scale
        const r = Math.max(6, 12 * state.scale)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(
        image,
        state.offsetX,
        state.offsetY,
        image.width * state.scale,
        image.height * state.scale,
      )

      if (!needsShape()) {
        drawEyeMarks()
        return
      }
      if (!hasSelection()) return

      // 選択の外側を落として、選んだところだけ元の明るさで描き直す
      ctx.fillStyle = 'rgba(10, 9, 8, 0.62)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      shapePath(ctx)
      ctx.clip()
      ctx.drawImage(
        image,
        state.offsetX,
        state.offsetY,
        image.width * state.scale,
        image.height * state.scale,
      )
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = '#d9a441'
      ctx.lineWidth = Math.max(2, 2 * Math.min(window.devicePixelRatio, 2))
      ctx.setLineDash([8, 6])
      shapePath(ctx)
      ctx.stroke()
      ctx.restore()
    }

    /* ---------- 入力（マウスもタッチも同じ経路） ---------- */

    function toCanvas(event) {
      const box = canvas.getBoundingClientRect()
      return {
        x: ((event.clientX - box.left) / box.width) * canvas.width,
        y: ((event.clientY - box.top) / box.height) * canvas.height,
      }
    }

    canvas.addEventListener('pointerdown', (event) => {
      if (!needsShape()) return
      // 画面外へ指が出ても追従させる。捕捉できない環境では黙って続行する
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {}
      state.drawing = true
      const point = toCanvas(event)
      if (state.mode === 'rect') state.rect = { x: point.x, y: point.y, w: 0, h: 0 }
      else state.path = [point]
      draw()
    })

    canvas.addEventListener('pointermove', (event) => {
      if (!state.drawing) return
      const point = toCanvas(event)
      if (state.mode === 'rect') {
        state.rect.w = point.x - state.rect.x
        state.rect.h = point.y - state.rect.y
      } else {
        state.path.push(point)
      }
      draw()
    })

    const finish = () => {
      if (!state.drawing) return
      state.drawing = false
      if (state.mode === 'rect' && state.rect) {
        // 逆向きに引かれても正の矩形に直す
        if (state.rect.w < 0) {
          state.rect.x += state.rect.w
          state.rect.w = -state.rect.w
        }
        if (state.rect.h < 0) {
          state.rect.y += state.rect.h
          state.rect.h = -state.rect.h
        }
      }
      draw()
    }
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)

    /* ---------- 切り出し ---------- */

    function bounds() {
      if (state.mode === 'rect') return state.rect
      const xs = state.path.map((p) => p.x)
      const ys = state.path.map((p) => p.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }

    function extract() {
      const box = bounds()
      // 表示座標から元画像の座標へ戻す
      const sx = (box.x - state.offsetX) / state.scale
      const sy = (box.y - state.offsetY) / state.scale
      const sw = box.w / state.scale
      const sh = box.h / state.scale

      const scale = Math.min(1, MAX_OUTPUT / Math.max(sw, sh))
      const out = document.createElement('canvas')
      out.width = Math.max(1, Math.round(sw * scale))
      out.height = Math.max(1, Math.round(sh * scale))
      const outCtx = out.getContext('2d')
      outCtx.imageSmoothingEnabled = true
      outCtx.imageSmoothingQuality = 'high'

      if (state.mode === 'free') {
        // 囲った形の外を落とす。下地の色が透ける
        outCtx.save()
        outCtx.beginPath()
        const k = scale / state.scale
        outCtx.moveTo((state.path[0].x - box.x) * k, (state.path[0].y - box.y) * k)
        for (const point of state.path.slice(1)) {
          outCtx.lineTo((point.x - box.x) * k, (point.y - box.y) * k)
        }
        outCtx.closePath()
        outCtx.clip()
      }

      outCtx.drawImage(image, sx, sy, sw, sh, 0, 0, out.width, out.height)
      if (state.mode === 'free') outCtx.restore()

      return out
    }

    /* ---------- 操作 ---------- */

    function syncMode() {
      for (const chip of root.querySelectorAll('.chip')) {
        chip.setAttribute('aria-checked', String(chip.dataset.mode === state.mode))
      }
      hint.textContent = byId(state.mode)?.hint ?? ''
      canvas.style.cursor = needsShape() ? 'crosshair' : 'default'
      root.querySelector('[data-act="apply"]').disabled = !canApply()
    }

    for (const chip of root.querySelectorAll('.chip')) {
      chip.addEventListener('click', () => {
        state.mode = chip.dataset.mode
        state.rect = null
        state.path = null
        syncMode()
        draw()
      })
    }

    function close(result) {
      observer.disconnect()
      document.removeEventListener('keydown', onKey)
      root.remove()
      resolve(result)
    }

    function onKey(event) {
      if (event.key === 'Escape') close(null)
    }

    root.addEventListener('click', (event) => {
      const act = event.target.closest('[data-act]')?.dataset.act
      if (act === 'cancel') close(null)
      if (act === 'replace') close({ replace: true })
      if (act === 'apply' && canApply()) {
        // 囲わないモードは元画像をそのまま返し、貼り方は呼び出し側に任せる
        close({
          mode: state.mode,
          canvas: needsShape() ? extract() : null,
          // 矩形は敷き詰め、フリーハンドは形を保つ
          fit: state.mode === 'free' ? 'contain' : 'cover',
          selection: { mode: state.mode, rect: state.rect, path: state.path },
        })
      }
    })

    canvas.addEventListener('pointerup', syncMode)
    canvas.addEventListener('pointercancel', syncMode)

    document.addEventListener('keydown', onKey)
    document.body.append(root)

    const observer = new ResizeObserver(layout)
    observer.observe(stage)
    syncMode()
    layout()
  })
}

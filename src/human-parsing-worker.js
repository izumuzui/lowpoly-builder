/**
 * SCHP-LIPをWebAssemblyのCPUで実行するWorker。
 * 写真はImageBitmapとして受け取り、分類マスクだけをメインスレッドへ返す。
 */

const INPUT_SIZE = 473
const CLASS_COUNT = 20
// 学習時のBGR由来の値だが、テンソルのチャンネル順はRGBのまま。
const MEAN = [0.406, 0.456, 0.485]
const STD = [0.225, 0.224, 0.229]

let parserPromise = null

function loadParser({ runtimeUrl, wasmBase, modelPath }) {
  if (!parserPromise) {
    parserPromise = (async () => {
      if (!self.ort) importScripts(runtimeUrl)
      self.ort.env.wasm.wasmPaths = wasmBase
      // SharedArrayBufferを前提にしない。iOS Safariを含め、通常のGitHub Pagesでも動かす。
      self.ort.env.wasm.numThreads = 1
      self.ort.env.wasm.proxy = false
      return self.ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
    })().catch((error) => {
      parserPromise = null
      throw error
    })
  }
  return parserPromise
}

function imageInput(image) {
  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const plane = INPUT_SIZE * INPUT_SIZE
  const values = new Float32Array(plane * 3)

  for (let index = 0; index < plane; index += 1) {
    const pixel = index * 4
    values[index] = (data[pixel] / 255 - MEAN[0]) / STD[0]
    values[plane + index] = (data[pixel + 1] / 255 - MEAN[1]) / STD[1]
    values[plane * 2 + index] = (data[pixel + 2] / 255 - MEAN[2]) / STD[2]
  }
  return values
}

function labelsFromLogits(logits) {
  const [, classCount, height, width] = logits.dims
  if (classCount !== CLASS_COUNT || !height || !width) {
    throw new Error('服の詳細分割モデルの出力形式を確認できませんでした')
  }
  const categories = new Uint8Array(width * height)
  for (let pixel = 0; pixel < categories.length; pixel += 1) {
    let bestClass = 0
    let bestValue = -Infinity
    for (let category = 0; category < classCount; category += 1) {
      const value = logits.data[category * categories.length + pixel]
      if (value > bestValue) {
        bestValue = value
        bestClass = category
      }
    }
    categories[pixel] = bestClass
  }
  return { width, height, categories }
}

async function segmentImage(image, options) {
  const parser = await loadParser(options)
  const inputName = parser.inputNames[0]
  const input = new self.ort.Tensor('float32', imageInput(image), [1, 3, INPUT_SIZE, INPUT_SIZE])
  const output = await parser.run({ [inputName]: input })
  const logits = output.logits ?? output[parser.outputNames[0]]
  if (!logits?.dims?.length || !logits.data) {
    throw new Error('服の詳細分割結果を取得できませんでした')
  }
  return labelsFromLogits(logits)
}

self.addEventListener('message', async (event) => {
  const { id, image, options } = event.data
  try {
    const result = await segmentImage(image, options)
    image.close?.()
    self.postMessage({
      id,
      ok: true,
      kind: 'human-parsing',
      model: 'schp-lip-20',
      labels: [
        '背景', '帽子', '髪', '手袋', 'サングラス', '上着', 'ワンピース', 'コート',
        '靴下', 'パンツ', 'つなぎ', 'マフラー', 'スカート', '顔', '左腕', '右腕',
        '左脚', '右脚', '左靴', '右靴',
      ],
      ...result,
    }, [result.categories.buffer])
  } catch (error) {
    image.close?.()
    self.postMessage({ id, ok: false, error: error?.message ?? String(error) })
  }
})

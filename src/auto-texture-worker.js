/** MediaPipeの同期セグメンテーションをUIスレッドから分離するWorker。 */

let segmenterPromise = null

function loadSegmenter({ visionBundle, wasmBase, modelPath }) {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      // 1.0.1のESM版はWorker内でWASMのModuleFactoryを初期化できないため、
      // Worker向けのclassic bundleをimportScriptsで読み込む。
      if (!self.Vision) importScripts(visionBundle)
      const { FilesetResolver, ImageSegmenter } = self.Vision
      const fileset = await FilesetResolver.forVisionTasks(wasmBase)
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      })
    })().catch((error) => {
      segmenterPromise = null
      throw error
    })
  }
  return segmenterPromise
}

function copyResult(result) {
  const mask = result?.categoryMask
  if (!mask) throw new Error('人物の領域マスクを取得できませんでした')
  const categories = new Uint8Array(mask.getAsUint8Array())
  const output = { width: mask.width, height: mask.height, categories }
  result.close?.()
  return output
}

/** 1.0系と新しいTasks Visionの両方で動くよう、コールバックと返り値の両方を扱う。 */
async function segmentImage(image, options) {
  const segmenter = await loadSegmenter(options)
  const output = await new Promise((resolve, reject) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      try {
        settled = true
        resolve(copyResult(result))
      } catch (error) {
        reject(error)
      }
    }

    try {
      const result = segmenter.segment(image, finish)
      if (result?.categoryMask) finish(result)
    } catch (error) {
      reject(error)
    }
  })
  return { ...output, labels: segmenter.getLabels?.() ?? [] }
}

self.addEventListener('message', async (event) => {
  const { id, image, options } = event.data
  try {
    const result = await segmentImage(image, options)
    image.close?.()
    self.postMessage({ id, ok: true, ...result }, [result.categories.buffer])
  } catch (error) {
    image.close?.()
    self.postMessage({ id, ok: false, error: error?.message ?? String(error) })
  }
})

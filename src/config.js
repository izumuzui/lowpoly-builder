/**
 * ESモジュール以外の外部URL。
 * モジュールのURLはindex.htmlのimportmapに集約してあるが、
 * WASMとモデルはimportmapで解決できないためここに集める。
 * フェーズ4でvendor化するときは、この2行だけをローカルパスに差し替える。
 */

export const MEDIAPIPE_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

/** Worker内ではimportmapが使えないため、MediaPipe本体の固定URLも共有する。 */
export const MEDIAPIPE_VISION_MODULE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs'

/**
 * BlazeFace short-range（約230KB）。
 * 位置合わせに使うのは両目の座標だけなので、478点を返すFaceLandmarker（約3.7MB）は使わない。
 */
export const FACE_DETECTOR_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

/**
 * Pose Landmarker Lite（約5.8MB）。33個の画像座標と推定3D座標を返す。
 * 写真を外へ送らず、ブラウザ内のCPUで姿勢を読み取る。
 */
export const POSE_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

/** 人物を背景・髪・肌・顔・服・小物の6領域へ分ける256pxモデル。 */
export const SELFIE_MULTICLASS_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'

/**
 * 服の種類まで分けるSCHP-LIP（INT8、約68MB）。初めて「自動で貼り付け」を実行した
 * ときだけ取得し、WebAssemblyのCPU推論用Workerで使う。写真そのものは送信しない。
 * LIPの20分類には上着・コート・パンツ・スカート・左右の靴などが含まれる。
 */
export const HUMAN_PARSING_MODEL =
  'https://huggingface.co/pirocheto/schp-lip-20/resolve/main/onnx/schp-lip-20-int8-static.onnx'

/** ONNX Runtime WebはWorker内でclassic bundleとして読み込む。 */
export const ONNX_RUNTIME_WEB =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort.min.js'

export const ONNX_RUNTIME_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'

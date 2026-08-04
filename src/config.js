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

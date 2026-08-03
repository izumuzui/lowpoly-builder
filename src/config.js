/**
 * ESモジュール以外の外部URL。
 * モジュールのURLはindex.htmlのimportmapに集約してあるが、
 * WASMとモデルはimportmapで解決できないためここに集める。
 * フェーズ4でvendor化するときは、この2行だけをローカルパスに差し替える。
 */

export const MEDIAPIPE_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

/**
 * BlazeFace short-range（約230KB）。
 * 位置合わせに使うのは両目の座標だけなので、478点を返すFaceLandmarker（約3.7MB）は使わない。
 */
export const FACE_DETECTOR_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

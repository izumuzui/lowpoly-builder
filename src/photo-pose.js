/**
 * 写真からMediaPipe Pose Landmarkerで3D姿勢を読み取り、Mixamo互換ボーンへ反映する。
 * 推論はブラウザ内のCPUだけで行い、画像を外部へ送信しない。
 */
import * as THREE from 'three'
import { MEDIAPIPE_WASM_BASE, POSE_LANDMARKER_MODEL } from './config.js?v=20260804-12'
import { BONE_PREFIX } from './skeleton.js'
import { applyPose } from './poses.js'

const LANDMARK = {
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftFoot: 31,
  rightFoot: 32,
}

const MIN_VISIBILITY = 0.45
const CORE_LANDMARKS = [
  LANDMARK.leftShoulder,
  LANDMARK.rightShoulder,
  LANDMARK.leftElbow,
  LANDMARK.rightElbow,
  LANDMARK.leftWrist,
  LANDMARK.rightWrist,
  LANDMARK.leftHip,
  LANDMARK.rightHip,
  LANDMARK.leftKnee,
  LANDMARK.rightKnee,
  LANDMARK.leftAnkle,
  LANDMARK.rightAnkle,
]

let landmarkerPromise = null

/** 初回だけWASMとモデルを取得し、以降の写真では同じインスタンスを使う。 */
export function loadPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('mediapipe-vision')
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE)
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_LANDMARKER_MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
      })
    })().catch((error) => {
      landmarkerPromise = null
      throw error
    })
  }
  return landmarkerPromise
}

/** 写真から、画像上の33点と推定3D座標を読み取る。 */
export async function detectPhotoPose(image) {
  const landmarker = await loadPoseLandmarker()
  const result = landmarker.detect(image)
  const landmarks = result.landmarks?.[0]
  const worldLandmarks = result.worldLandmarks?.[0]

  if (!landmarks?.length || !worldLandmarks?.length) {
    result.close?.()
    throw new Error('人物の姿勢を検出できませんでした')
  }

  const plainLandmarks = landmarks.map(copyLandmark)
  const plainWorld = worldLandmarks.map(copyLandmark)
  result.close?.()

  const torso = [
    LANDMARK.leftShoulder,
    LANDMARK.rightShoulder,
    LANDMARK.leftHip,
    LANDMARK.rightHip,
  ]
  if (!torso.every((index) => visibilityOf(plainLandmarks[index]) >= MIN_VISIBILITY)) {
    throw new Error('肩と腰が見える全身写真を選んでください')
  }

  const scores = CORE_LANDMARKS.map((index) => visibilityOf(plainLandmarks[index]))
  const confidence = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const visibleLandmarks = plainLandmarks.filter(
    (landmark) => visibilityOf(landmark) >= MIN_VISIBILITY,
  ).length

  return { landmarks: plainLandmarks, worldLandmarks: plainWorld, confidence, visibleLandmarks }
}

/** 3Dランドマークの各関節ベクトルを、現在のボーンのローカル回転へ変換する。 */
export function applyPhotoPose(mesh, detection) {
  applyPose(mesh, 'tpose')

  const bones = new Map(mesh.skeleton.bones.map((bone) => [shortBoneName(bone.name), bone]))
  const points = detection.worldLandmarks.map(toModelPoint)
  const confidence = detection.landmarks.map(visibilityOf)
  const root = bones.get('Hips')
  const applied = new Set()

  const usable = (...indices) => indices.every((index) =>
    points[index] && confidence[index] >= MIN_VISIBILITY,
  )
  const midpoint = (a, b) => points[a].clone().add(points[b]).multiplyScalar(0.5)
  const update = () => root.updateMatrixWorld(true)

  // 腰と胸は左右の関節線をX軸、体の中心線をY軸として、ひねりも含む姿勢を作る。
  if (usable(
    LANDMARK.leftShoulder,
    LANDMARK.rightShoulder,
    LANDMARK.leftHip,
    LANDMARK.rightHip,
  )) {
    const hipCenter = midpoint(LANDMARK.leftHip, LANDMARK.rightHip)
    const shoulderCenter = midpoint(LANDMARK.leftShoulder, LANDMARK.rightShoulder)
    const pelvisFrame = frameQuaternion(
      points[LANDMARK.leftHip],
      points[LANDMARK.rightHip],
      hipCenter,
      shoulderCenter,
    )
    const torsoFrame = frameQuaternion(
      points[LANDMARK.leftShoulder],
      points[LANDMARK.rightShoulder],
      hipCenter,
      shoulderCenter,
    )
    if (pelvisFrame) {
      setWorldQuaternion(bones.get('Hips'), pelvisFrame)
      applied.add('Hips')
      update()
    }
    if (torsoFrame) {
      setWorldQuaternion(bones.get('Spine'), torsoFrame)
      applied.add('Spine')
      update()
    }

    // 耳が隠れている写真では目を使い、頭の傾きだけでも残す。
    const headPair = usable(LANDMARK.leftEar, LANDMARK.rightEar)
      ? [LANDMARK.leftEar, LANDMARK.rightEar]
      : usable(LANDMARK.leftEye, LANDMARK.rightEye)
        ? [LANDMARK.leftEye, LANDMARK.rightEye]
        : null
    if (headPair) {
      const headCenter = midpoint(headPair[0], headPair[1])
      const headFrame = frameQuaternion(
        points[headPair[0]],
        points[headPair[1]],
        shoulderCenter,
        headCenter,
      )
      if (headFrame) {
        setWorldQuaternion(bones.get('Head'), headFrame)
        applied.add('Head')
        update()
      }
    }
  }

  const segments = [
    ['LeftArm', 'LeftForeArm', LANDMARK.leftShoulder, LANDMARK.leftElbow],
    ['LeftForeArm', 'LeftHand', LANDMARK.leftElbow, LANDMARK.leftWrist],
    ['RightArm', 'RightForeArm', LANDMARK.rightShoulder, LANDMARK.rightElbow],
    ['RightForeArm', 'RightHand', LANDMARK.rightElbow, LANDMARK.rightWrist],
    ['LeftUpLeg', 'LeftLeg', LANDMARK.leftHip, LANDMARK.leftKnee],
    ['LeftLeg', 'LeftFoot', LANDMARK.leftKnee, LANDMARK.leftAnkle],
    ['RightUpLeg', 'RightLeg', LANDMARK.rightHip, LANDMARK.rightKnee],
    ['RightLeg', 'RightFoot', LANDMARK.rightKnee, LANDMARK.rightAnkle],
    ['LeftFoot', 'LeftToeBase', LANDMARK.leftAnkle, LANDMARK.leftFoot],
    ['RightFoot', 'RightToeBase', LANDMARK.rightAnkle, LANDMARK.rightFoot],
  ]

  for (const [boneName, childName, start, end] of segments) {
    if (!usable(start, end)) continue
    const direction = points[end].clone().sub(points[start])
    if (alignBoneToWorldDirection(bones.get(boneName), bones.get(childName), direction)) {
      applied.add(boneName)
      update()
    }
  }

  // 膝を曲げた姿勢でも足元が床から浮かないよう、ルートだけ上下へ移動する。
  if (usable(LANDMARK.leftAnkle) || usable(LANDMARK.rightAnkle)) groundFeet(mesh, bones)
  update()
  return { appliedBones: applied.size }
}

function copyLandmark(landmark) {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
    presence: landmark.presence,
  }
}

function visibilityOf(landmark) {
  if (!landmark) return 0
  return Math.min(landmark.visibility ?? 1, landmark.presence ?? 1)
}

/** MediaPipeのY-down・手前が-Zを、モデルのY-up・手前が+Zへ変換する。 */
function toModelPoint(point) {
  return new THREE.Vector3(point.x, -point.y, -point.z)
}

/** 左右軸と上下軸から、直交した人体座標系の回転を作る。 */
function frameQuaternion(left, right, bottom, top) {
  const x = left.clone().sub(right)
  const y = top.clone().sub(bottom)
  if (x.lengthSq() < 1e-8 || y.lengthSq() < 1e-8) return null

  x.normalize()
  y.addScaledVector(x, -y.dot(x))
  if (y.lengthSq() < 1e-8) return null
  y.normalize()
  const z = x.clone().cross(y)
  if (z.lengthSq() < 1e-8) return null
  z.normalize()
  y.copy(z).cross(x).normalize()

  const matrix = new THREE.Matrix4().makeBasis(x, y, z)
  return new THREE.Quaternion().setFromRotationMatrix(matrix).normalize()
}

/** 指定したワールド回転になるよう、親を差し引いたローカル回転を入れる。 */
function setWorldQuaternion(bone, worldQuaternion) {
  if (!bone) return
  const parentWorld = new THREE.Quaternion()
  bone.parent?.getWorldQuaternion(parentWorld)
  bone.quaternion.copy(parentWorld.invert().multiply(worldQuaternion)).normalize()
}

/** ボーンから子ボーンへの初期方向を、写真の関節ベクトルへ向ける。 */
function alignBoneToWorldDirection(bone, child, worldDirection) {
  if (!bone || !child || worldDirection.lengthSq() < 1e-8) return false
  const restDirection = child.position.clone().normalize()
  const parentWorld = new THREE.Quaternion()
  bone.parent?.getWorldQuaternion(parentWorld)
  const targetInParent = worldDirection.clone().normalize().applyQuaternion(parentWorld.invert())
  bone.quaternion.setFromUnitVectors(restDirection, targetInParent).normalize()
  return true
}

function groundFeet(mesh, bones) {
  mesh.updateMatrixWorld(true)
  const candidates = ['LeftFoot', 'RightFoot', 'LeftToe_End', 'RightToe_End']
    .map((name) => bones.get(name))
    .filter(Boolean)
    .map((bone) => bone.getWorldPosition(new THREE.Vector3()).y)
  if (!candidates.length) return

  const hips = bones.get('Hips')
  const height = mesh.userData.spec?.height ?? 1.7
  const floor = 0.012 * height
  const shift = floor - Math.min(...candidates)
  if (Number.isFinite(shift) && Math.abs(shift) < height * 0.7) hips.position.y += shift
}

function shortBoneName(name) {
  return name.startsWith(BONE_PREFIX) ? name.slice(BONE_PREFIX.length) : name
}

/**
 * PS1風の描画表現。
 *
 * ShaderMaterialを自前で書くと、three.jsが提供するスキニング処理を再実装することになる。
 * そのため既存マテリアルに onBeforeCompile でシェーダーを注入する方式を採る。
 */
import * as THREE from 'three'

export const DEFAULT_LOOK = {
  /** 頂点を粗いグリッドにスナップする。動かすと座標が量子化されプルプル揺れる */
  jitter: true,
  /** 透視補正を打ち消す。面が傾くとテクスチャがぐにゃりと歪む */
  affine: true,
  /**
   * ライティングを行わない。既定で有効。
   * 陰影は頂点カラーに焼き込んであるため、実行時のライトを足すと二重に暗くなる。
   * glTFにはKHR_materials_unlitとして書き出される。
   */
  unlit: true,
  /** 内部描画解像度の倍率。1未満で低解像度に描いて引き伸ばす */
  renderScale: 0.5,
}

/** スナップ先のグリッド。初代PlayStationのフレームバッファ幅に合わせる */
const SNAP_RESOLUTION = new THREE.Vector2(320, 240)

const VERTEX_HEAD = /* glsl */ `
  uniform vec2 uSnapResolution;
  uniform float uJitter;
  uniform float uAffine;
  varying float vAffineW;
`

const VERTEX_BODY = /* glsl */ `
  if (uJitter > 0.5) {
    vec2 grid = uSnapResolution * 0.5;
    gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;
  }

  // アフィンテクスチャマッピング。
  // ラスタライザはvaryingをwで割って補間するため、頂点側であらかじめwを掛けておくと
  // 透視補正が打ち消され、スクリーン空間で線形に補間される（PS1の歪みの正体）。
  float affineW = mix(1.0, gl_Position.w, uAffine);
  vAffineW = affineW;
  #ifdef USE_MAP
    vMapUv *= affineW;
  #endif
`

const FRAGMENT_HEAD = /* glsl */ `
  varying float vAffineW;
`

const FRAGMENT_MAP = /* glsl */ `
  #ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAffineW );
    diffuseColor *= sampledDiffuseColor;
  #endif
`

function createMaterial(texture, look) {
  // 陰影は頂点カラーに焼き込んである（body.js の bakeShading）
  const options = { map: texture, vertexColors: true }
  const material = look.unlit
    ? new THREE.MeshBasicMaterial(options)
    : new THREE.MeshLambertMaterial(options)

  const uniforms = {
    uSnapResolution: { value: SNAP_RESOLUTION },
    uJitter: { value: look.jitter ? 1 : 0 },
    uAffine: { value: look.affine ? 1 : 0 },
  }
  material.userData.psx = uniforms

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      // project_vertex より後に入れる必要がある（gl_Position が確定してから使うため）
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_BODY}`)

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <map_fragment>', FRAGMENT_MAP)
  }

  // 注入後のシェーダーを他のマテリアルと取り違えないようにする
  material.customProgramCacheKey = () => `psx-${look.unlit ? 'basic' : 'lambert'}`

  return material
}

/**
 * メッシュに見た目設定を反映する。
 * ジッターとアフィンはユニフォームだけ書き換え、
 * ライティングの有無はマテリアルの種類が変わるため作り直す。
 */
export function applyLook(mesh, look) {
  const needsRebuild =
    !mesh.material.userData.psx || mesh.material.isMeshBasicMaterial !== !!look.unlit

  if (needsRebuild) {
    const texture = mesh.material.map
    const name = mesh.material.name
    mesh.material.dispose()
    mesh.material = createMaterial(texture, look)
    mesh.material.name = name
  } else {
    const uniforms = mesh.material.userData.psx
    uniforms.uJitter.value = look.jitter ? 1 : 0
    uniforms.uAffine.value = look.affine ? 1 : 0
  }
}

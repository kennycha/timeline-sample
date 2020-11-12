import React, { useState, useEffect } from 'react'
import styled from 'styled-components';
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'
import { DragControls } from 'three/examples/jsm/controls/DragControls'

const MAP_TYPES = ['map', 'aoMap', 'emissiveMap', 'glossinessMap', 'metalnessMap', 'normalMap', 'roughnessMap', 'specularMap']

const Input = styled.input`
  display: block;
`

const RenderingDiv = styled.div`
  width: 800px;
  height: 800px;
`

const PlayBtn = styled.button`
  display: block;
  width: 800px;
  height: 30px;
`


function App() {
  const [contents, setContents] = useState([])  // clear하기 위해 content 담아놓은 array
  const [blobURL, setBlobURL] = useState(null)  //  파일 읽었을 떄 생성하는 파일 URL
  const [currentBone, setCurrentBone] = useState(null)  // 현재 드래그한 Bone

  const [loadedAnimations, setLoadedAnimations] = useState(null)  // load한 파일의 gltf.animations
  const [editingAnimation, setEditingAnimation] = useState(null)  // 재생되는 애니메이션

  const [aniMixer, setAniMixer] = useState(null)  // animation mixer
  const [togglePlay, setTogglePlay] = useState(false)
  
  // 렌더 시에 바탕 및 기본요소 렌더링
  useEffect(() => {
    // canvas의 parentNode에 해당하는 요소 선택
    const renderingDiv = document.body.querySelector('#renderingDiv')

    const scene = new THREE.Scene() // scene 생성
    scene.background = new THREE.Color(0xbbbbbb)  // scene 배경색
    scene.fog = new THREE.Fog(0xbbbbbb, 10, 80) // scene 안개
    
    const fov = 45
    const aspect = window.innerWidth / window.innerHeight
    const near = 0.1
    const far = 100
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far) // camera 생성
    camera.position.set(-10, 10, 10) // camera 위치
    camera.lookAt(0, 1, 0)  // camera 방향

    const renderer = new THREE.WebGL1Renderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true // 그림자 보이게 설정
    renderer.outputEncoding = THREE.sRGBEncoding  // 결과물 encoding 설정
    renderer.setSize(renderingDiv.clientWidth, renderingDiv.clientHeight) // renderer 사이즈 설정

    // 반구형 조명 및 스포트라이트 생성 및 설정 후 scene에 추가
    const hemiLight = new THREE.HemisphereLight(0x0e0e0e) // 반구형 조명
    hemiLight.position.set(0, 20, 0)
    const spotLight = new THREE.SpotLight(0xffffff, 2)  // 스포트라이트
    spotLight.castShadow = true
    spotLight.angle = 0.25
    spotLight.penumbra = 0.2
    spotLight.decay = 2
    spotLight.distance = 50
    spotLight.position.set(5, 10, 5)
    const spotLightHelper = new THREE.SpotLightHelper(spotLight)  // spot light helper 생성 및 추가 (광원에서 쏘는 직선 5개)
    scene.add(hemiLight, spotLightHelper, spotLight)

    // ground 생성 및 scene에 추가
    const texture = new THREE.TextureLoader().load('textures/texture_01.png', () => {renderer.render(scene, camera)})
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(30, 30)
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(100, 100),
      new THREE.MeshPhongMaterial({
        color: 0xbbbbbb,
        map: texture,
        depthWrite: false,
        side: THREE.DoubleSide  // 양면 모두 불투명하도록 설정
      })
    )
    groundMesh.position.set(0, 0, 0)
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.receiveShadow = true
    scene.add(groundMesh)

    // 카메라 컨트롤러 생성 및 설정
    const cameraControls = new OrbitControls(camera, renderer.domElement)
    cameraControls.target.set(0, 1, 0)
    cameraControls.update()
    cameraControls.enablePan = true
    cameraControls.enabled = true
    cameraControls.maxDistance = 30 // zoom-out limitation

    // 트랜스폼 컨트롤러 생성 (bone에 부착된 mesh 움직이는 컨트롤러)
    const transformControls = new TransformControls(camera, renderer.domElement)    
    // 변화 발생 시 렌더링하는 콜백의 경우, 이벤트 리스너가 아닌 useEffect를 통해 할 수 있지 않을까..해서 일단은 주석 처리
    transformControls.addEventListener('change', (event) => {
      renderer.render(scene, camera)
    })
    transformControls.addEventListener('dragging-changed', event => {
      cameraControls.enabled = !event.value // 요소 드래그 중에는 카메라 이동 불가하도록 설정
    })

    // 컨트롤러 달려있는 대상에 변화 발생하면 trigger 모든 변화가 끝난 후에만 한 번 업데이트 하도록
    // objectChange 대신 mouseUp 이벤트를 사용
    transformControls.addEventListener('mouseUp', event => {
      const currentIndex = 3      
      // target bone의 속성값을 사용해서 새로운 애니메이션 생성
      createNewAnimation(event.target.object, event.target.mode, currentIndex)
    })


    // 트랜스폼 컨트롤러 scene에 추가
    scene.add(transformControls)

    // 키보드 이벤트 콜백 함수 정의
    const onKeyDown = (event) => {
      switch (event.keyCode) {
        case 27:  // esc
          // 현재 transformControl 붙어 있는 것 제거
          transformControls.detach(transformControls.object)  
          // 전역 state에서 잡고 있는 currentBone 초기화도 해야 함
          break
        case 81:  // q
          // 이동방향 기준 범위 변경
          transformControls.setSpace(transformControls.space === 'local' ? 'world' : 'local')
          break
        case 91:  // cmd or win
          // 설정한 단위로 변경
          transformControls.setTranslationSnap(10)
          transformControls.setRotationSnap(THREE.MathUtils.degToRad(15))
          break
        case 87:  // w
          // position 변경 모드
          transformControls.setMode('translate')
          break
        case 69:  // e
          // rotation 변경 모드
          transformControls.setMode('rotate')
          break
        case 82:  // r
          // scale 변경 모드
          transformControls.setMode('scale')
          break
        case 187: // +, =, num+
        case 107: 
          // transformControls 크기 증가
          if (transformControls.size < 2.0) {
            transformControls.setSize(transformControls.size + 0.1)
          }
          break
        case 189: // -, _, num-
        case 109: 
          // transformControls 크기 감소
          if (transformControls.size > 0.2) {
            transformControls.setSize(transformControls.size-0.1)
          }
          break  
        default:
          break
      }
    }
    const onKeyUp = (event) => {
      switch (event.keyCode) {
        case 91:
          // 기본 단위로 변경
          transformControls.setTranslationSnap(null)
          transformControls.setRotationSnap(null)
          break
        default:
          break
      }
    }

    if (blobURL) {
      // 파일 업로드를 통해 blobURL이 생성되었다면

      // renderingDiv에 키보드 단축키 등록
      renderingDiv.addEventListener('keydown', onKeyDown)
      renderingDiv.addEventListener('keyup', onKeyUp)

      const loader = new GLTFLoader() // loader 생성
      loader.load(blobURL, (gltf) => {
        setLoadedAnimations(gltf.animations)
        setEditingAnimation(gltf.animations[0])
        console.log('gltf.animations(check AnimationClip.tracks): ')
        console.log(gltf.animations)

        const model = gltf.scene || gltf.scenes[0]
        scene.add(model)  // load 후 model을 scene에 추가
        
        // gltf.scene 내에 mesh가 존재한다면 그림자 추가
        model.traverse(obj => {
          if (obj.isMesh) {
            obj.castShadow = true
          }
        })

        // skeleton helper 생성 및 가시화
        const skeletonHelper = new THREE.SkeletonHelper(model)
        skeletonHelper.visible = true
        
        const innerBones = []
        // skeleton helper의 bones 순회하며, 구형 mesh 추가 및 boneObjs 변경
        skeletonHelper.bones.forEach(bone => {         
          // Bone에 부착할 Mesh 정의
          const boneMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, opacity: 0.5, transparent: true })
          boneMaterial.depthWrite = false // skin 내부에 있어도 보이도록 설정
          boneMaterial.depthTest = false
          // mesh 크기를 model에 따라 다르게 만들어야 함 -> 일단은 넘어가고 다음에 변경
          const boneGeometry = new THREE.SphereGeometry(0.015, 32, 32)
          const boneMesh = new THREE.Mesh(boneGeometry, boneMaterial)

          // bone에 부착
          bone.add(boneMesh)        
          
          innerBones.push(bone)

        })

        // skeleton bones를 모두 담았을 때
        if (innerBones.length === skeletonHelper.bones.length) {           
          // bones를 param에 넣어서 드래그 컨트롤러 생성
          const dragControls = new DragControls(innerBones, camera, renderer.domElement)

          // 드래그 컨트롤러 이벤트 리스너 추가
          dragControls.addEventListener('hoveron', (event) => {
            cameraControls.enabled = false
          })

          dragControls.addEventListener('hoveroff', (event) => {
            cameraControls.enabled = true
          })

          dragControls.addEventListener('dragstart', (event) => {
            if (currentBone !== event.object.parent) {
              transformControls.attach(event.object.parent)
              setCurrentBone(event.object.parent)
              dragControls.enabled = false
            } 
          })

          dragControls.addEventListener('dragend', event => {
            dragControls.enabled = true
          })
        }       
        // scene에 skelton helper 추가
        scene.add(skeletonHelper)      

        // mixer 생성
        const mixer = new THREE.AnimationMixer(gltf.scene)
        setAniMixer(mixer)
      })
    } 

    
    // RenderingDiv 아래에 새로운 canvas를 생성하고, scene과 camera를 추가
    renderingDiv.appendChild(renderer.domElement)
    
    const animate = () => {
      // animate loop를 통해 렌더링
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    requestAnimationFrame(animate)

    return () => {
      // 키보드 단축키 삭제
      renderingDiv.removeEventListener('keydown', onKeyDown)
      renderingDiv.removeEventListener('keyup', onKeyUp)

      // 기존에 rendering 되어 있는 canvas를 삭제
      while (renderingDiv.firstChild) {
        renderingDiv.removeChild(renderingDiv.firstChild)
      }

      // contents clear
      contents.forEach(content => {
        // scene에서 삭제
        scene.remove(content)
        // content 및 하위 노드들이 mesh라면 geometry 및 material dispose
        content.traverse(node => {
          if (!node.isMesh) return
          node.geometry.dispose()
          const materials = Array.isArray(node.material) ? node.material : [node.material]
          materials.forEach(material => {
            MAP_TYPES.forEach(mapType => {
              material[mapType]?.dispose()
            })
          })
        })
      })
      setContents([])
    }
  }, [blobURL])

  // File 업로드 시 URL로 변경해서 컴포넌트 state로 관리
  const onFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      const fileURL = URL.createObjectURL(file) // blob URL
      setBlobURL(fileURL) // 읽은 URL을 컴포넌트 state에서 관리
    }
  } 

  // animation play (현재는 클릭 시 단위 움직임)
  const onPlayBtnClick = () => {
    setTogglePlay(!togglePlay)
    
    const clip = editingAnimation
    const action = aniMixer.clipAction(clip)
    action.play()
    
    const update = () => {
      aniMixer.update(0.1)
    }
    
    setInterval(() => {
      update()
    }, 100);
  }

  // 애니메이션 교체 로직
  const createNewAnimation = (targetBone, currentMode, currentFrame) => {
    // 현재 컴포넌트 상태 값 가져오는 과정에서 버그(한번 리렌더 된 다음부터 먹힘) 있는데, 본 프로젝트에서 리덕스로 변경할 때 수정할 것
    let editingTrack
    let editingTrackIndex
    let newTrack
    let newValues
    let newTracks
    let newAnimation
    
    switch (currentMode) {
      case 'translate':
        // 조작한 Bone에 해당하는 track 과 그 인덱스 찾기
        editingTrack = editingAnimation?.tracks.find(track => track.name === `${targetBone.name}.position`)
        editingTrackIndex = editingAnimation?.tracks.findIndex(track => track === editingTrack)
        
        // 마지막 조작 때의 값으로 new track 생성
        newValues = editingTrack.values.slice()
        newValues[currentFrame * 3] = targetBone.position.x
        newValues[currentFrame * 3 + 1] = targetBone.position.y
        newValues[currentFrame * 3 + 2] = targetBone.position.z

        newTrack = new THREE.VectorKeyframeTrack(editingTrack.name, editingTrack.times, newValues)   
        break
      case 'rotate': 
        editingTrack = editingAnimation?.tracks.find(track => track.name === `${targetBone.name}.quaternion`)
        editingTrackIndex = editingAnimation?.tracks.findIndex(track => track === editingTrack)
        
        newValues = editingTrack.values.slice()
        newValues[currentFrame * 4] = targetBone.quaternion.w
        newValues[currentFrame * 4 + 1] = targetBone.quaternion.x
        newValues[currentFrame * 4 + 2] = targetBone.quaternion.y
        newValues[currentFrame * 4 + 3] = targetBone.quaternion.z

        newTrack = new THREE.QuaternionKeyframeTrack(editingTrack.name, editingTrack.times, newValues)
        break
      case 'scale':
        editingTrack = editingAnimation?.tracks.find(track => track.name === `${targetBone.name}.scale`)
        editingTrackIndex = editingAnimation?.tracks.findIndex(track => track === editingTrack)
        
        newValues = editingTrack.values.slice()
        newValues[currentFrame * 3] = targetBone.scale.x
        newValues[currentFrame * 3 + 1] = targetBone.scale.y
        newValues[currentFrame * 3 + 2] = targetBone.scale.z

        newTrack = new THREE.VectorKeyframeTrack(editingTrack.name, editingTrack.times, newValues)
        break
      default:
        break
    }
    // newTracks 생성 후 다시 newAnimation 생성
    // EditingAnimation으로 set하는데 redux 연결할 때 주의 필요
    newTracks = editingAnimation.tracks.slice()
    newTracks[editingTrackIndex] = newTrack
    newAnimation = new THREE.AnimationClip(editingAnimation.name, editingAnimation.duration, newTracks)
    setEditingAnimation(newAnimation)
  }


  return (
    <>
      <Input type='file' accept='.glb' onChange={onFileChange} />
      <RenderingDiv id='renderingDiv' />
      <PlayBtn onClick={onPlayBtnClick} disabled={!Boolean(loadedAnimations)} >Play Button</PlayBtn>
    </>
  );
}

export default App;

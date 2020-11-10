import React, { useEffect, useState } from 'react'
import styled from 'styled-components';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const Input = styled.input`
  display: block;
`

function App() {
  const [loadedAnimations, setLoadedAnimations] = useState(null)  // load한 파일의 gltf.animations

  useEffect(() => {

    return () => {
      
    }
  }, [])


  // File 업로드 시 읽어서 animations 뽑아내서 컴포넌트 상태(loadedAnimations) 변경
  const onFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      const fileURL = URL.createObjectURL(file)
      const loader = new GLTFLoader() // loader 생성
      loader.load(fileURL, gltf => {
        setLoadedAnimations(gltf.animations)
        console.log('gltf.animations: ', gltf.animations)
      })
    }
  }

  return (
    <>
      <Input type='file' accept='.glb' onChange={onFileChange} />
      <div>{loadedAnimations?.length}</div>
    </>
  );
}

export default App;

import './App.scss';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';

import  Game from './components/Game';

// get the employee id from the url parameters
const params = new URLSearchParams(window.location.search);
const employeeId = params.get('id');

// placeholder rocket model path
let model1Path = './assets/models/elf_rocket.glb';

// once the models are ready and added in the models folder in the below file format, uncomment the line below
// model1Path = `/assets/models/elf_model_${employeeId}.glb`;

const hdriPath = './assets/hdri/resting_place_1k.hdr';
const markerPath = `./assets/markers/qrs/qr${employeeId}.mind`;

let currentModelIndex = {};
let isAnimating = false;
let modelsPreloaded = false;

const ARComponent = () => {
  const [showGame, setShowGame] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [startExperience, setStartExperience] = useState(false);
  const containerRef = useRef(null);
  const clock = new THREE.Clock();

  const modelTransformations = [
    {
      model: null,
      position: new THREE.Vector3(0, -0.1, 0),
      scale: new THREE.Vector3(0.008, 0.008, 0.008),
      faceCamera: false,
      rotation: new THREE.Euler(0, 0.5, 0),
    }
  ];

  useEffect(() => {
    if (isAnimating) return;
    if (!startExperience) return;

    let modelsForAnchors = {};

    const mindarThree = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: markerPath,
      // filterMinCF: 0.01,
      // filterBeta: 0.075,
      // warmupTolerance: 10,
      // uiScanning: '#wj-scanning-overlay',
    });

    const { renderer, scene, camera } = mindarThree;

    const anchors = [
      { id: 0, anchor: mindarThree.addAnchor(0) }
    ];

    if (anchors.length === 0) {
      console.error('No anchors available. Exiting AR setup.');
      return;
    }

    const loader = new GLTFLoader();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    let lightProbe;

    const setupScene = async (models, anchor) => {
      const { anchor: fAnchor, id } = anchor;
      const mixerMap = new Map();
      let prevTime;

      const light = new THREE.PointLight(0xffffff, 0.4);
      const ambient = new THREE.AmbientLight(0xffffff, 0.95);
      const dirLight = new THREE.DirectionalLight( 0xffffff );
      dirLight.position.set( 1, 0, 100 );
      scene.add( dirLight );
      scene.add(light);
      scene.add(ambient);

      scene.environment = lightProbe.texture;

      const createShadowLights = () => {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
        directionalLight.position.set(0, 0, 0);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.top = 1;
        directionalLight.shadow.camera.bottom = -1;
        directionalLight.shadow.camera.left = -1;
        directionalLight.shadow.camera.right = 1;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 1000;
        directionalLight.shadow.bias = -0.0001;

        return { directionalLight };
      };

      const addLightsToAnchor = () => {
        const { directionalLight } = createShadowLights();
        fAnchor.group.add(directionalLight);
      };

      const enableShadows = (model) => {
        scene.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;

            // Check if the material of the mesh supports transparency
            if (
              object.material &&
              object.material.transparent !== undefined
            ) {
              object.material.transparent = true; // Enable transparency
              object.material.opacity = 1; // Set initial opacity (1 for fully visible)
            }
          }
        });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      };
      
      const animate = () => {
        requestAnimationFrame(animate);

        const currentTime = clock.getElapsedTime();
        const deltaTime = currentTime - prevTime;

        const models = modelsForAnchors[id];

        // optional rotation if it makes sense
        models[0].model.rotation.y += 0.03;

        mixerMap.forEach((mixer) => {
          if (mixer) {
            mixer.update(deltaTime);
          }
        });

        renderer.render(scene, camera);

        prevTime = currentTime;
      };

      const runModelAnimationAndHide = async (model, id) => {
        if (!model) return;
        const { position, scale, rotation } = modelTransformations[0];
        model.position.copy(position);
        model.position.y -= 0.6;
        model.scale.copy(scale);

        const { x, y, z } = camera.position;
        model.lookAt(x, y, z);
        model.userData = { clickable: true };

        if (rotation) {
          model.rotation.copy(rotation);
        }

        fAnchor.group.add(model);

        enableShadows(model);
      };

      const handleMarkerFound = async () => {
        if (isAnimating) return;
        isAnimating = true;
        console.log(`Target ${id} found!`);
        const models = modelsForAnchors[id];
        
        models[0].visible = false;

        const { model, animated } = models[0];
        model.visible = true;

        if (animated) {
          await runModelAnimationAndHide(model, id);
        }
      };

      const handleMarkerLost = () => {
        isAnimating = false;
        console.log(`Target ${id} lost!`, models);
        models[0].visible = false;
      };

      if (!isAnimating) {
        fAnchor.onTargetFound = handleMarkerFound;
      }
      fAnchor.onTargetLost = handleMarkerLost;

      if (models.length > 1) {
        currentModelIndex[id] = 0;
        models[0].visible = true;
      }

      // Add lights to the anchor's group
      addLightsToAnchor();
      prevTime = performance.now();
      animate();
    };

    const onLoadProgress = (progress) => {
      setLoadingProgress(progress.loaded / 9358764);
    };

    const preloadHDRTexture = async () => {
      return new Promise((resolve, reject) => {
        const environmentHDR = new RGBELoader();
        environmentHDR.load(
          hdriPath,
          (texture) => {
            lightProbe = pmremGenerator.fromEquirectangular(texture).texture;
            texture.dispose();
            resolve();
          },
          undefined,
          (error) => {
            reject(error);
          }
        );
      });
    };

    const preloadModels = async () => {
      if (modelsPreloaded) return;
      modelsPreloaded = true;

      const preloadModel = (modelPath) => {
        return new Promise((resolve, reject) => {
          loader.load(
            modelPath,
            (gltf) => {
              const model = gltf.scene;
              const animations = gltf.animations;
              if (animations && animations.length > 0) {
                // Assign animations to the model
                model.animations = animations;
              }

              resolve(model);
            },
            onLoadProgress,
            (error) => {
              reject(error);
            }
          );
        });
      };

      try {
        const model1 = await Promise.resolve(preloadModel(model1Path));

        modelsForAnchors = {
          0: [{ model: model1, animated: true }],
        };

        modelTransformations[0].model = model1;

        // Additional setup or preprocessing if needed

        anchors.forEach((anchor, index) => {
          const models = modelsForAnchors[anchor.id];

          if (Array.isArray(models) && models.length >= 1) {
            setupScene(models, anchor, index);
          } else {
            console.error(`Invalid models for anchor with id ${anchor.id}`);
          }
        });
      } catch (error) {
        console.error('Error preloading models:', error);
      }
    }

    const startAR = async () => {
      console.log("starting AR!");

      try {
        await preloadHDRTexture();
        await preloadModels();
        mindarThree.start();
      } catch (error) {
        console.error('Error starting AR:', error);
      }
    };
    

    startAR();
    

    // Clean up the MindARThree instance when component unmounts
    return () => {
      if (mindarThree.renderer) {
        mindarThree.renderer.dispose();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startExperience]);

  return (
    <div className="ar-container">
      {!startExperience ? (
        <div className="splash">
          <div className="splash-inner">
            <svg xmlns="http://www.w3.org/2000/svg" width="49" height="48" viewBox="0 0 49 48" fill="none">
              <g clip-path="url(#clip0_2719_1009)">
                <path d="M47.1795 45.733C46.9903 45.733 46.8362 45.8873 46.8362 46.0838C46.8362 46.2804 46.9903 46.428 47.1795 46.428C47.3687 46.428 47.53 46.2735 47.53 46.0838C47.53 45.8941 47.376 45.733 47.1795 45.733ZM43.1628 44.5817C43.2329 44.1466 43.5974 43.8305 44.0183 43.8305C44.4392 43.8305 44.7824 44.1253 44.8737 44.5817H43.1631H43.1628ZM45.399 45.0029V44.9044C45.399 43.9921 44.8451 43.3812 44.018 43.3812C43.1909 43.3812 42.6018 44.006 42.6018 44.8973C42.6018 45.7885 43.1838 46.4417 44.0248 46.4417C44.6208 46.4417 45.0482 46.1821 45.371 45.6135L44.9503 45.3747C44.8241 45.578 44.768 45.6553 44.6767 45.7467C44.5087 45.8941 44.2841 45.9856 44.0532 45.9856C43.5273 45.9856 43.1558 45.5996 43.1277 45.0026H45.3988L45.399 45.0029ZM41.3053 43.6552C41.0038 43.4587 40.7445 43.3817 40.4079 43.3817C39.5246 43.3817 38.8515 44.0486 38.8515 44.919C38.8515 45.7895 39.5246 46.4422 40.3939 46.4422C40.7303 46.4422 40.9686 46.3649 41.3263 46.1403V45.4808C40.9896 45.8599 40.7516 45.9861 40.3656 45.9861C39.8051 45.9861 39.3632 45.5155 39.3632 44.9122C39.3632 44.3089 39.8051 43.8378 40.3869 43.8378C40.7445 43.8378 40.9825 43.9642 41.3053 44.3153V43.6552ZM35.9425 43.8308C36.5172 43.8308 36.9242 44.2659 36.9242 44.8836C36.9242 45.5365 36.5313 45.9858 35.9496 45.9858C35.3678 45.9858 34.9963 45.5223 34.9963 44.8767C34.9963 44.2874 35.4096 43.8308 35.9425 43.8308ZM36.8887 43.4448V43.8591C36.6012 43.522 36.2928 43.3746 35.8793 43.3746C35.0732 43.3746 34.4841 44.0134 34.4841 44.8978C34.4841 45.7822 35.08 46.4422 35.8793 46.4422C36.2999 46.4422 36.6085 46.2948 36.8887 45.9509V46.3581H37.3865V43.445H36.8887V43.4448ZM32.7451 43.9077H33.4809V43.4445H32.7451V42.3215C32.7451 41.7952 32.8291 41.6547 33.1445 41.6547C33.2568 41.6547 33.3269 41.6691 33.4809 41.7251V41.2193C33.313 41.1704 33.2429 41.1562 33.0955 41.1562C32.8223 41.1562 32.5838 41.2616 32.4297 41.4511C32.3035 41.6055 32.2474 41.837 32.2474 42.2022V43.4448H31.9737V43.908H32.2474V46.3581H32.7451V43.908V43.9077ZM30.2704 45.733C30.0812 45.733 29.9272 45.8873 29.9272 46.0838C29.9272 46.2804 30.0812 46.428 30.2704 46.428C30.4596 46.428 30.621 46.2735 30.621 46.0838C30.621 45.8941 30.4667 45.733 30.2704 45.733ZM28.406 43.9077C28.2307 43.557 27.9641 43.3815 27.6277 43.3815C27.1231 43.3815 26.7584 43.7256 26.7584 44.1957C26.7584 44.5817 26.9268 44.7504 27.5999 45.0452C27.9641 45.1994 28.0694 45.3048 28.0694 45.5292C28.0694 45.7893 27.8663 45.9858 27.5999 45.9858C27.3194 45.9858 27.1793 45.8734 27.0108 45.5152L26.5692 45.6978C26.7584 46.1963 27.1021 46.4419 27.5926 46.4419C28.1465 46.4419 28.5811 46.0276 28.5811 45.4945C28.5811 45.2204 28.4761 45.01 28.2586 44.8557C28.1255 44.7572 28.0415 44.7152 27.7046 44.5749C27.326 44.4206 27.2352 44.3292 27.2352 44.1537C27.2352 43.9782 27.3963 43.8378 27.5923 43.8378C27.7608 43.8378 27.8867 43.9293 27.9922 44.1258L28.406 43.908V43.9077ZM23.8633 43.8308C24.4172 43.8308 24.8166 44.2874 24.8166 44.9398C24.8166 45.5223 24.4033 45.9858 23.8704 45.9858C23.3025 45.9858 22.8887 45.5436 22.8887 44.9327C22.8887 44.2798 23.2886 43.8305 23.8633 43.8305M22.9239 48.0003V45.9506C23.2115 46.2877 23.5269 46.4419 23.9333 46.4419C24.7326 46.4419 25.3283 45.8032 25.3283 44.9469C25.3283 44.0273 24.7465 43.3746 23.9404 43.3746C23.5198 43.3746 23.2044 43.522 22.9241 43.8591V43.4448H22.4263V48.0003H22.9241H22.9239ZM20.5197 41.9847C20.3232 41.9847 20.1621 42.146 20.1621 42.3423C20.1621 42.5386 20.3232 42.7004 20.5197 42.7004C20.7162 42.7004 20.8769 42.5391 20.8769 42.3423C20.8769 42.1455 20.7157 41.9847 20.5197 41.9847ZM20.7651 43.4448H20.2673V46.3579H20.7651V43.4448ZM18.6128 41.2406H18.115V46.3579H18.6128V41.2406ZM16.1384 45.733C15.9492 45.733 15.7946 45.8873 15.7946 46.0838C15.7946 46.2804 15.9489 46.428 16.1384 46.428C16.3278 46.428 16.4887 46.2735 16.4887 46.0838C16.4887 45.8941 16.3346 45.733 16.1384 45.733ZM14.2737 43.9077C14.0984 43.557 13.8321 43.3815 13.4957 43.3815C12.9911 43.3815 12.6263 43.7256 12.6263 44.1957C12.6263 44.5817 12.7943 44.7504 13.4673 45.0452C13.8318 45.1994 13.9373 45.3048 13.9373 45.5292C13.9373 45.7893 13.7337 45.9858 13.4673 45.9858C13.1871 45.9858 13.0467 45.8734 12.8788 45.5152L12.4371 45.6978C12.6263 46.1963 12.9698 46.4419 13.4605 46.4419C14.0144 46.4419 14.449 46.0276 14.449 45.4945C14.449 45.2204 14.3438 45.01 14.1265 44.8557C13.9934 44.7572 13.909 44.7152 13.5726 44.5749C13.1939 44.4206 13.1026 44.3292 13.1026 44.1537C13.1026 43.9782 13.264 43.8378 13.4603 43.8378C13.6287 43.8378 13.7547 43.9293 13.8602 44.1258L14.2734 43.908L14.2737 43.9077ZM8.96684 44.5817C9.03691 44.1466 9.40139 43.8305 9.82227 43.8305C10.2432 43.8305 10.5864 44.1253 10.6777 44.5817H8.9671H8.96684ZM11.2033 45.0029V44.9044C11.2033 43.9921 10.6494 43.3812 9.82227 43.3812C8.99517 43.3812 8.40608 44.006 8.40608 44.8973C8.40608 45.7885 8.98809 46.4417 9.8291 46.4417C10.425 46.4417 10.8527 46.1821 11.1752 45.6135L10.7546 45.3747C10.6284 45.578 10.5722 45.6553 10.4814 45.7467C10.313 45.8941 10.0886 45.9856 9.85743 45.9856C9.33158 45.9856 8.96001 45.5996 8.93194 45.0026H11.2031L11.2033 45.0029ZM5.69258 46.0838L4.75318 48.0003H5.31394L7.46592 43.4448H6.89808L5.95867 45.5294L4.92846 43.4448H4.35379L5.69258 46.0841V46.0838ZM1.18576 44.5817C1.25582 44.1466 1.6203 43.8305 2.04119 43.8305C2.46208 43.8305 2.80531 44.1253 2.89662 44.5817H1.18576ZM3.42222 45.0029V44.9044C3.42222 43.9921 2.86829 43.3812 2.04119 43.3812C1.21409 43.3812 0.625 44.006 0.625 44.8973C0.625 45.7885 1.20701 46.4417 2.04802 46.4417C2.64394 46.4417 3.0714 46.1821 3.39415 45.6135L2.97351 45.3747C2.8473 45.578 2.79115 45.6553 2.69984 45.7467C2.53189 45.8941 2.30728 45.9856 2.07584 45.9856C1.55024 45.9856 1.17868 45.5996 1.15085 45.0026H3.42197L3.42222 45.0029Z" fill="white"/>
                <path d="M10.4945 16.1798C13.8518 16.1798 17.2092 18.5745 17.5773 24.4232H3.13585C3.13585 20.3012 6.58514 16.1798 10.4948 16.1798M10.7705 15.1665C5.23598 15.1665 0.5 18.8505 0.5 26.1272C0.5 33.4038 5.77322 37.4561 11.0462 37.4561C14.6796 37.4561 17.3473 35.6143 19.0951 34.0023L18.2215 33.1733C18.2215 33.1733 15.6458 36.1667 11.5983 36.1667C7.55086 36.1667 3.04378 33.2275 3.04378 25.6667H20.1071C20.1071 21.1996 17.4852 15.1665 10.7705 15.1665Z" fill="white"/>
                <path d="M22.1768 35.6602C21.7574 35.6602 21.418 36.0003 21.418 36.42C21.418 36.8396 21.7577 37.1798 22.1768 37.1798C22.5959 37.1798 22.9356 36.8396 22.9356 36.42C22.9356 36.0003 22.5959 35.6602 22.1768 35.6602Z" fill="white"/>
                <path d="M32.626 35.6602C32.2066 35.6602 31.8672 36.0003 31.8672 36.42C31.8672 36.8396 32.2069 37.1798 32.626 37.1798C33.0451 37.1798 33.3848 36.8396 33.3848 36.42C33.3848 36.0003 33.0451 35.6602 32.626 35.6602Z" fill="white"/>
                <path d="M42.8994 35.6602C42.4801 35.6602 42.1406 36.0003 42.1406 36.42C42.1406 36.8396 42.4803 37.1798 42.8994 37.1798C43.3185 37.1798 43.6582 36.8396 43.6582 36.42C43.6582 36.0003 43.3185 35.6602 42.8994 35.6602Z" fill="white"/>
                <path d="M26.2695 2.62533V37.1806H28.7991V0.123047C27.5342 0.123047 26.2695 0.73722 26.2695 2.62533Z" fill="white"/>
                <path d="M43.3789 0C39.7913 0 36.4492 2.54812 36.4492 8.56576V37.1802H38.9022V16.5485H45.3412V15.1669H38.9022V8.50472C38.9022 4.48283 40.0058 1.10526 43.7163 1.10526C45.7704 1.10526 47.089 2.45644 47.733 3.34668L48.4991 2.67121C48.4991 2.67121 46.9666 0 43.3789 0Z" fill="white"/>
              </g>
              <defs>
                <clipPath id="clip0_2719_1009">
                  <rect width="48" height="48" fill="white" transform="translate(0.5)"/>
                </clipPath>
              </defs>
            </svg>
            <ol>
              <li>Click <b>Start</b></li>
              <li>Allow camera access</li>
              <li>Hold the camera over your name tag and re-scan your QR code</li>
            </ol>
            <p><button onClick={() => setStartExperience(true)}>Start</button></p>
          </div>
        </div>
      ) : (
      <div className="mindar-canvas" ref={containerRef}>
        {showGame ? <Game /> : (
          <div id="wj-scanning-overlay" className="hidden">
            <div className="inner">
              <div className="scanline"></div>
              <div
                className="loader-bar"
                style={{ width: `${loadingProgress * 80}%` }}
              ></div>
            </div> 
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default ARComponent;

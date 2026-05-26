import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_BUCKET, SUPABASE_URL } from "./config.js";
import FrameCastQr from "./vendor/qrcode.js";

const startButton = document.querySelector("#startButton");
const saveFrameButton = document.querySelector("#saveFrameButton");
const refreshCodesButton = document.querySelector("#refreshCodesButton");
const clientMode = document.querySelector("#clientMode");
const ownerMode = document.querySelector("#ownerMode");
const clientPanel = document.querySelector("#clientPanel");
const ownerPanel = document.querySelector("#ownerPanel");
const frameNameInput = document.querySelector("#frameNameInput");
const imagePicker = document.querySelector("#imagePicker");
const videoPicker = document.querySelector("#videoPicker");
const mindPicker = document.querySelector("#mindPicker");
const targetPreview = document.querySelector("#targetPreview");
const targetTitle = document.querySelector("#targetTitle");
const targetHelp = document.querySelector("#targetHelp");
const codesList = document.querySelector("#codesList");
const statusText = document.querySelector("#statusText");
const supportDot = document.querySelector("#supportDot");
const overlay = document.querySelector("#overlay");
const overlayText = document.querySelector("#overlayText");

const DB_NAME = "framecast-ar";
const STORE_NAME = "frames";
const FRAME_PREFIX = "frame-";
const isCloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isCloudConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let selectedVideoUrl = "";
let selectedImageUrl = "";
let activeFrame = null;

const setStatus = (message, state = "pending") => {
  statusText.textContent = message;
  supportDot.className = `dot ${state === "ready" ? "ready" : state === "error" ? "error" : ""}`;
};

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (db.objectStoreNames.contains("frame-experience")) db.deleteObjectStore("frame-experience");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const dbPutFrame = async (frame) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(frame);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

const dbGetFrame = async (id) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};

const dbGetAllFrames = async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};

const sanitizeFileName = (name) => name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");

const uploadAsset = async (frameId, kind, file) => {
  const path = `${frameId}/${kind}-${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
};

const cloudPutFrame = async (frame) => {
  const { error } = await supabase.from("frames").insert({
    id: frame.id,
    name: frame.name,
    image_name: frame.imageName,
    image_url: frame.imageUrl,
    image_path: frame.imagePath,
    video_name: frame.videoName,
    video_url: frame.videoUrl,
    video_path: frame.videoPath,
    mind_name: frame.mindName,
    mind_url: frame.mindUrl,
    mind_path: frame.mindPath,
  });
  if (error) throw error;
};

const cloudGetFrame = async (id) => {
  const { data, error } = await supabase.from("frames").select("*").eq("id", id).single();
  if (error) return null;
  return {
    id: data.id,
    name: data.name,
    imageName: data.image_name,
    imageUrl: data.image_url,
    imagePath: data.image_path,
    videoName: data.video_name,
    videoUrl: data.video_url,
    videoPath: data.video_path,
    mindName: data.mind_name,
    mindUrl: data.mind_url,
    mindPath: data.mind_path,
    createdAt: new Date(data.created_at).getTime(),
  };
};

const cloudGetAllFrames = async () => {
  const { data, error } = await supabase.from("frames").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((frame) => ({
    id: frame.id,
    name: frame.name,
    imageName: frame.image_name,
    imageUrl: frame.image_url,
    imagePath: frame.image_path,
    videoName: frame.video_name,
    videoUrl: frame.video_url,
    videoPath: frame.video_path,
    mindName: frame.mind_name,
    mindUrl: frame.mind_url,
    mindPath: frame.mind_path,
    createdAt: new Date(frame.created_at).getTime(),
  }));
};

const putFrame = (frame) => (isCloudConfigured ? cloudPutFrame(frame) : dbPutFrame(frame));
const getFrame = (id) => (isCloudConfigured ? cloudGetFrame(id) : dbGetFrame(id));
const getAllFrames = () => (isCloudConfigured ? cloudGetAllFrames() : dbGetAllFrames());

const setMode = (mode) => {
  const isClient = mode === "client";
  clientPanel.hidden = !isClient;
  ownerPanel.hidden = isClient;
  clientMode.classList.toggle("active", isClient);
  ownerMode.classList.toggle("active", !isClient);
};

const getFrameUrl = (frameId) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("frame", frameId);
  return url.toString();
};

const getFrameIdFromUrl = () => new URL(window.location.href).searchParams.get("frame");

const makeFrameId = async () => {
  const frames = await getAllFrames();
  const next = frames.length + 1;
  const suffix = String(next).padStart(3, "0");
  return `${FRAME_PREFIX}${suffix}-${crypto.randomUUID().slice(0, 8)}`;
};

const applyFrame = (frame) => {
  activeFrame = frame;
  targetPreview.src = frame.imageUrl || URL.createObjectURL(frame.image);
  targetTitle.textContent = frame.name;
  targetHelp.textContent = `Scan link loaded: ${frame.id}. Video: ${frame.videoName}.${frame.mindUrl ? " iPhone target ready." : ""}`;
  setStatus(`Loaded ${frame.name}. Client scan is ready.`, "ready");
};

const buildDemoVideo = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  let frame = 0;

  const draw = () => {
    frame += 1;
    const hue = (frame * 0.8) % 360;
    const pulse = Math.sin(frame / 18) * 0.5 + 0.5;
    ctx.fillStyle = "#111318";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, `hsl(${hue}, 78%, 54%)`);
    gradient.addColorStop(1, `hsl(${(hue + 110) % 360}, 78%, 46%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
    ctx.fillStyle = "#fffaf0";
    ctx.font = "800 74px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DEMO VIDEO", canvas.width / 2, canvas.height - 64);
    requestAnimationFrame(draw);
  };

  draw();
  return canvas.captureStream(30);
};

const drawQr = (canvas, text) => {
  if (FrameCastQr) {
    const qr = FrameCastQr(0, "M");
    qr.addData(text);
    qr.make();
    const ctx = canvas.getContext("2d");
    const moduleCount = qr.getModuleCount();
    const scale = Math.floor(canvas.width / moduleCount);
    const offset = Math.floor((canvas.width - moduleCount * scale) / 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (qr.isDark(row, col)) ctx.fillRect(offset + col * scale, offset + row * scale, scale, scale);
      }
    }
    canvas.dataset.link = text;
    return;
  }

  const ctx = canvas.getContext("2d");
  const size = 29;
  const scale = Math.floor(canvas.width / size);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawFinder = (x, y) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(x * scale, y * scale, 7 * scale, 7 * scale);
    ctx.fillStyle = "#fff";
    ctx.fillRect((x + 1) * scale, (y + 1) * scale, 5 * scale, 5 * scale);
    ctx.fillStyle = "#000";
    ctx.fillRect((x + 2) * scale, (y + 2) * scale, 3 * scale, 3 * scale);
  };

  drawFinder(1, 1);
  drawFinder(21, 1);
  drawFinder(1, 21);

  let seed = 0;
  for (let i = 0; i < text.length; i += 1) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;

  ctx.fillStyle = "#000";
  for (let y = 1; y < 28; y += 1) {
    for (let x = 1; x < 28; x += 1) {
      const inFinder =
        (x < 9 && y < 9) ||
        (x > 19 && y < 9) ||
        (x < 9 && y > 19);
      if (inFinder) continue;
      seed = (1664525 * seed + 1013904223) >>> 0;
      if (((seed >>> 16) & 1) === 1) ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  canvas.dataset.link = text;
};

const renderCodes = async () => {
  const frames = (await getAllFrames()).sort((a, b) => b.createdAt - a.createdAt);
  codesList.textContent = "";

  if (!frames.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No frame codes yet. Open Owner setup, add an image and video, then save.";
    codesList.append(empty);
    return;
  }

  frames.forEach((frame) => {
    const link = getFrameUrl(frame.id);
    const card = document.createElement("article");
    card.className = "code-card";

    const canvas = document.createElement("canvas");
    canvas.width = 116;
    canvas.height = 116;
    drawQr(canvas, link);

    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = frame.name;
    const url = document.createElement("p");
    url.textContent = link;

    const actions = document.createElement("div");
    actions.className = "code-actions";
    const open = document.createElement("a");
    open.href = link;
    open.textContent = "Open scan link";
    const download = document.createElement("a");
    download.href = canvas.toDataURL("image/png");
    download.download = `${frame.id}-scan-code.png`;
    download.textContent = "Download code";
    const copy = document.createElement("button");
    copy.className = "copy-link";
    copy.type = "button";
    copy.textContent = "Copy link";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(link);
      setStatus(`Copied scan link for ${frame.name}.`, "ready");
    });

    actions.append(open, download, copy);
    content.append(title, url, actions);
    card.append(canvas, content);
    codesList.append(card);
  });
};

imagePicker.addEventListener("change", () => {
  if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
  const [file] = imagePicker.files;
  selectedImageUrl = file ? URL.createObjectURL(file) : "";
  targetPreview.src = selectedImageUrl || "./assets/framecast-target.svg";
  targetTitle.textContent = file ? "Selected frame image" : "Demo frame image";
  targetHelp.textContent = file
    ? "Save this with a video to generate a unique scan code."
    : "Owner setup controls which image triggers the AR video. The client only scans the final physical frame.";
  setStatus(file ? `Frame image selected: ${file.name}` : "Default demo image selected", "ready");
});

videoPicker.addEventListener("change", () => {
  if (selectedVideoUrl) URL.revokeObjectURL(selectedVideoUrl);
  const [file] = videoPicker.files;
  selectedVideoUrl = file ? URL.createObjectURL(file) : "";
  setStatus(file ? `Video selected: ${file.name}` : "No video selected", "ready");
});

saveFrameButton.addEventListener("click", async () => {
  const [imageFile] = imagePicker.files;
  const [videoFile] = videoPicker.files;

  if (!imageFile || !videoFile) {
    setStatus("Choose both the frame image and the video before saving.", "error");
    return;
  }

  try {
    saveFrameButton.disabled = true;
    setStatus(isCloudConfigured ? "Uploading frame image and video to Supabase..." : "Saving frame locally...");

    const id = await makeFrameId();
    const [mindFile] = mindPicker.files;
    const uploadedImage = isCloudConfigured ? await uploadAsset(id, "image", imageFile) : null;
    const uploadedVideo = isCloudConfigured ? await uploadAsset(id, "video", videoFile) : null;
    const uploadedMind = isCloudConfigured && mindFile ? await uploadAsset(id, "target", mindFile) : null;

    const frame = {
      id,
      name: frameNameInput.value.trim() || imageFile.name.replace(/\.[^.]+$/, "") || "Customer frame",
      image: isCloudConfigured ? null : imageFile,
      imageName: imageFile.name,
      imageUrl: uploadedImage?.url,
      imagePath: uploadedImage?.path,
      video: isCloudConfigured ? null : videoFile,
      videoName: videoFile.name,
      videoUrl: uploadedVideo?.url,
      videoPath: uploadedVideo?.path,
      mindName: mindFile?.name || "",
      mindUrl: uploadedMind?.url || "",
      mindPath: uploadedMind?.path || "",
      createdAt: Date.now(),
    };

    await putFrame(frame);
    applyFrame(frame);
    setMode("client");
    setStatus(`Generated cloud scan code for ${frame.name}.`, "ready");
    await renderCodes();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not save this frame.", "error");
  } finally {
    saveFrameButton.disabled = false;
  }
});

clientMode.addEventListener("click", () => setMode("client"));
ownerMode.addEventListener("click", () => setMode("owner"));
refreshCodesButton.addEventListener("click", renderCodes);

const loadTrackingImage = async () => {
  const blob = activeFrame?.imageUrl
    ? await fetch(activeFrame.imageUrl).then((response) => response.blob())
    : activeFrame?.image || (await fetch("./assets/framecast-target.svg").then((response) => response.blob()));
  return createImageBitmap(blob);
};

const makeVideoElement = async () => {
  const video = document.createElement("video");
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.crossOrigin = "anonymous";
  video.srcObject = activeFrame ? null : buildDemoVideo();
  if (activeFrame?.videoUrl) video.src = activeFrame.videoUrl;
  else if (activeFrame) video.src = URL.createObjectURL(activeFrame.video);
  await video.play();
  return video;
};

const isImageTrackingReady = async () => {
  if (!("xr" in navigator)) return false;
  return navigator.xr.isSessionSupported("immersive-ar");
};

const startAR = async () => {
  if (!navigator.xr?.requestSession) {
    if (activeFrame?.mindUrl) {
      window.location.href = `./mindar.html?frame=${encodeURIComponent(activeFrame.id)}`;
      return;
    }

    setStatus("This browser needs an iPhone target .mind file for camera AR. Add one in Owner setup.", "error");
    return;
  }

  startButton.disabled = true;
  const targetLabel = activeFrame?.name || "demo target";
  setStatus(`Preparing camera and ${targetLabel}...`);

  try {
    const [trackingImage, video] = await Promise.all([loadTrackingImage(), makeVideoElement()]);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.xr.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const videoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.52), material);
    videoPlane.visible = false;
    scene.add(videoPlane);

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local-floor", "image-tracking"],
      trackedImages: [{ image: trackingImage, widthInMeters: 0.18 }],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: overlay },
    });

    overlay.hidden = false;
    overlayText.textContent = activeFrame ? "Find the picture frame" : "Find the FrameCast target";
    await renderer.xr.setSession(session);
    const referenceSpace = await session.requestReferenceSpace("local-floor");

    session.addEventListener("end", () => {
      overlay.hidden = true;
      video.pause();
      renderer.domElement.remove();
      startButton.disabled = false;
      setStatus("AR session ended", "ready");
    });

    renderer.setAnimationLoop((time, frame) => {
      if (!frame) return;
      const results = frame.getImageTrackingResults?.() ?? [];
      const target = results[0];

      if (target?.trackingState === "tracked") {
        const pose = frame.getPose(target.imageSpace, referenceSpace);
        if (pose) {
          videoPlane.visible = true;
          videoPlane.matrix.fromArray(pose.transform.matrix);
          videoPlane.matrix.decompose(videoPlane.position, videoPlane.quaternion, videoPlane.scale);
          overlayText.textContent = "Video locked";
        }
      } else {
        videoPlane.visible = false;
        overlayText.textContent = activeFrame ? "Find the picture frame" : "Find the FrameCast target";
      }

      renderer.render(scene, camera);
    });

    setStatus("AR is running", "ready");
  } catch (error) {
    console.error(error);
    startButton.disabled = false;
    overlay.hidden = true;
    setStatus(error.message || "Could not start AR on this device", "error");
  }
};

startButton.addEventListener("click", startAR);

const restoreFromUrl = async () => {
  const frameId = getFrameIdFromUrl();
  if (!frameId) return false;

  const frame = await getFrame(frameId);
  if (!frame) {
    setStatus(isCloudConfigured ? "This scan code was not found in Supabase." : "This scan code is not stored in this demo browser yet.", "error");
    return false;
  }

  applyFrame(frame);
  setMode("client");
  return true;
};

isImageTrackingReady().then((ready) => {
  setStatus(
    ready ? "AR is available. Client scan is ready." : "This browser may not support WebXR image tracking. Try Chrome on Android.",
    ready ? "ready" : "error",
  );
});

await restoreFromUrl();
try {
  await renderCodes();
  if (isCloudConfigured) setStatus("Cloud mode is connected. Owner setup will save to Supabase.", "ready");
} catch (error) {
  console.error(error);
  setStatus(error.message || "Could not load generated scan codes.", "error");
}

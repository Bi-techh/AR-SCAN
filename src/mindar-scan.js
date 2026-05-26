import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const status = document.querySelector("#mindStatus");
const startButton = document.querySelector("#mindStartButton");
const scene = document.querySelector("#scene");
const video = document.querySelector("#frameVideo");
const target = document.querySelector("#target");

const setStatus = (message) => {
  status.textContent = message;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForScene = async () => {
  setStatus("Loading camera scanner...");
  for (let i = 0; i < 80; i += 1) {
    if (scene.hasLoaded && scene.systems?.["mindar-image-system"]) return;
    await wait(250);
  }
  throw new Error("Camera scanner library did not finish loading. Check internet connection and refresh.");
};

const frameId = new URL(window.location.href).searchParams.get("frame");

if (window.location.protocol === "file:") {
  setStatus("Open this scanner from your Vercel scan link, not as a local file.");
} else if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  setStatus("Cloud setup is missing. Add Supabase config first.");
} else if (!frameId) {
  setStatus("Missing frame code. Open a generated scan link first.");
} else {
  try {
    await waitForScene();
    setStatus("Loading frame data...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from("frames").select("*").eq("id", frameId).single();

    if (error || !data) {
      setStatus("Frame code not found.");
    } else if (!data.mind_url) {
      setStatus("This frame needs an iPhone .mind target file.");
    } else {
      scene.setAttribute("mindar-image", `imageTargetSrc: ${data.mind_url}; autoStart: false; uiScanning: yes;`);
      video.src = data.video_url;
      setStatus(`Ready to scan ${data.name}`);
      startButton.hidden = false;

      startButton.addEventListener("click", async () => {
        startButton.hidden = true;
        setStatus("Starting camera...");
        await scene.systems["mindar-image-system"].start();
        setStatus(`Point your camera at ${data.name}`);
      });

      target.addEventListener("targetFound", async () => {
        setStatus("Video locked");
        try {
          await video.play();
        } catch {
          setStatus("Tap the screen to start video");
        }
      });

      target.addEventListener("targetLost", () => {
        setStatus(`Point your camera at ${data.name}`);
        video.pause();
      });

      document.body.addEventListener("click", () => video.play(), { once: true });
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Scanner could not start. Refresh and allow camera permission.");
    startButton.hidden = false;
  }
}

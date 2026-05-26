import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const status = document.querySelector("#mindStatus");
const scene = document.querySelector("#scene");
const video = document.querySelector("#frameVideo");
const target = document.querySelector("#target");

const setStatus = (message) => {
  status.textContent = message;
};

const frameId = new URL(window.location.href).searchParams.get("frame");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  setStatus("Cloud setup is missing. Add Supabase config first.");
} else if (!frameId) {
  setStatus("Missing frame code.");
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.from("frames").select("*").eq("id", frameId).single();

  if (error || !data) {
    setStatus("Frame code not found.");
  } else if (!data.mind_url) {
    setStatus("This frame needs an iPhone .mind target file.");
  } else {
    scene.setAttribute("mindar-image", `imageTargetSrc: ${data.mind_url}; autoStart: true; uiScanning: yes;`);
    video.src = data.video_url;
    setStatus(`Point your camera at ${data.name}`);

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
}

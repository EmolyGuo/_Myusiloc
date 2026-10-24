let mediaStream;

async function startRecording() {
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: true
  });

  console.log("Microphone is active");
  console.log(mediaStream.getAudioTracks());
}

function stopRecording() {
  mediaStream?.getTracks().forEach(track => track.stop());
  mediaStream = null;
}
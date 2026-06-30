export function createPlayerAdapter(videoElement) {
  return {
    getSpeed() {
      return videoElement.playbackRate;
    },
    setSpeed(speed) {
      videoElement.playbackRate = speed;
    },
    onRateChange(handler) {
      videoElement.addEventListener('ratechange', handler);
      return () => videoElement.removeEventListener('ratechange', handler);
    },
    isReady() {
      return videoElement.readyState >= 1;
    },
  };
}

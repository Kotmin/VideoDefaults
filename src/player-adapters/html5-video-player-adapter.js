export function createPlayerAdapter(videoElement) {
  return {
    getSpeed() {
      return videoElement.playbackRate;
    },
    setSpeed(speed) {
      const moviePlayer = typeof videoElement.closest === 'function'
        ? videoElement.closest('#movie_player')
        : null;
      if (moviePlayer && typeof moviePlayer.setPlaybackRate === 'function') {
        moviePlayer.setPlaybackRate(speed);
      }
      videoElement.defaultPlaybackRate = speed;
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

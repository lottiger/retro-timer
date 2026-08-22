import { useAudioPlayer } from 'expo-audio';

const chimeSource = require('../assets/chime.wav');

/** Returns a function that plays the soft finished-chime. */
export function useChime(): () => void {
  const player = useAudioPlayer(chimeSource);
  return () => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // audio is a nice-to-have; never let it break the timer
    }
  };
}

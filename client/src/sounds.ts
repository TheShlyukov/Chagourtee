import incomingSound from '../sounds/Incoming.wav';
import mentionedSound from '../sounds/Mentioned.wav';
import sentSound from '../sounds/Sent.wav';

function createAudio(src: string) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
}

const incomingAudio = createAudio(incomingSound);
const mentionedAudio = createAudio(mentionedSound);
const sentAudio = createAudio(sentSound);

function safePlay(audio: HTMLAudioElement) {
  try {
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // Игнорируем ошибки автоплея/разрешений
  }
}

export function playIncoming() {
  safePlay(incomingAudio);
}

export function playMention() {
  safePlay(mentionedAudio);
}

export function playSent() {
  safePlay(sentAudio);
}


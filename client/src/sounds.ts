import incomingSound from '../sounds/Incoming.wav';
import mentionedSound from '../sounds/Mentioned.wav';
import sentSound from '../sounds/Sent.wav';

class SoundPlayer {
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private isIOS: boolean;
  private readonly soundMap: Record<string, string> = {
    incoming: incomingSound,
    mention: mentionedSound,
    sent: sentSound
  };

  constructor() {
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.initAudioContext();
    this.loadBuffers();
    if (this.isIOS) {
      this.setupIOSUnlock();
    }
  }

  private initAudioContext() {
    // Create context but don't activate until user gesture
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    // Suspend context to save resources
    if (this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  private async loadBuffers() {
    // Load all sounds and decode into buffers
    const promises = Object.entries(this.soundMap).map(async ([name, src]) => {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.buffers.set(name, audioBuffer);
    });
    await Promise.all(promises);
  }

  private setupIOSUnlock() {
    // On iOS we need to unlock context after first touch
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    
    const unlockHandler = async () => {
      events.forEach(event => document.removeEventListener(event, unlockHandler));
      
      if (this.audioContext && this.audioContext.state !== 'running') {
        await this.audioContext.resume();
      }
    };
    
    events.forEach(event => {
      document.addEventListener(event, unlockHandler, { once: true });
    });
  }

  private async ensureAudioContextRunning() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        return true;
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
        return false;
      }
    }
    return this.audioContext?.state === 'running';
  }

  private async playSound(name: string) {
    // Ensure the audio context is running
    const isRunning = await this.ensureAudioContextRunning();
    
    if (!isRunning) {
      console.warn(`Audio context not ready for ${name} sound`);
      return;
    }

    const buffer = this.buffers.get(name);
    if (!buffer) {
      console.error(`Sound ${name} not loaded`);
      return;
    }

    // Create a source for each playback
    const source = this.audioContext!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext!.destination);
    source.start(0);
  }

  playIncoming() { this.playSound('incoming'); }
  playMention()  { this.playSound('mention'); }
  playSent()     { this.playSound('sent'); }

  // Can suspend/resume context when needed
  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

const soundPlayer = new SoundPlayer();

export const playIncoming = () => soundPlayer.playIncoming();
export const playMention  = () => soundPlayer.playMention();
export const playSent     = () => soundPlayer.playSent();
export { soundPlayer };
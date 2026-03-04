import incomingSound from '../sounds/Incoming.wav';
import mentionedSound from '../sounds/Mentioned.wav';
import sentSound from '../sounds/Sent.wav';

class SoundPlayer {
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private readonly soundMap: Record<string, string> = {
    incoming: incomingSound,
    mention: mentionedSound,
    sent: sentSound
  };
  private isIOS: boolean;
  private unlocked: boolean = false;

  constructor() {
    // Detect if we're on iOS
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Pre-create and preload audio elements as required for iOS compatibility
    this.preloadSounds();
    
    // For iOS, we need to ensure audio is unlocked for playback
    if (this.isIOS) {
      this.setupIOSUnlock();
    }
  }

  private preloadSounds() {
    // Create audio elements early and preload them to satisfy iOS requirements
    Object.entries(this.soundMap).forEach(([name, src]) => {
      const audio = new Audio();
      audio.src = src;
      audio.preload = 'auto'; // Preload for faster playback
      audio.volume = 0.3; // Set reasonable default volume
      audio.style.display = 'none'; // Hide the audio element
      
      // Store the audio element
      this.audioElements.set(name, audio);
      
      // Add the hidden audio element to the document to ensure it works on iOS
      document.body.appendChild(audio);
      
      // For iOS, listen to canplaythrough to know when audio is ready
      if (this.isIOS) {
        audio.addEventListener('canplaythrough', () => {
          // Mark as loaded when ready
          audio.setAttribute('data-loaded', 'true');
        }, { once: true });
      }
    });
  }

  private setupIOSUnlock() {
    // iOS requires an initial user interaction to enable audio playback
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    
    const unlockHandler = () => {
      // Remove all event listeners after first successful interaction
      events.forEach(event => {
        document.removeEventListener(event, unlockHandler);
      });
      
      this.unlocked = true;
      
      // Play and pause each audio to initialize them
      this.audioElements.forEach(audio => {
        // Play and pause immediately to prepare for later playback
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => {
          // Ignore errors during unlocking, as this is just preparation
        });
      });
    };
    
    // Add unlock handler to multiple events to increase chance of capture
    events.forEach(event => {
      document.addEventListener(event, unlockHandler, { once: true });
    });
  }

  private playSound(name: string) {
    const audio = this.audioElements.get(name);
    
    if (!audio) {
      console.error(`Sound ${name} not found`);
      return;
    }

    // For iOS, ensure we're unlocked before attempting playback
    if (this.isIOS && !this.unlocked) {
      // Cache the request to play this sound
      setTimeout(() => {
        // Try to play again after a brief delay, hoping user has interacted
        if (this.unlocked) {
          this.attemptPlay(audio);
        } else {
          // If still not unlocked, we can't play until user interacts
          console.warn(`Cannot play ${name} sound on iOS until user interacts with page`);
        }
      }, 100);
      return;
    }

    this.attemptPlay(audio);
  }

  private attemptPlay(audio: HTMLAudioElement) {
    // Reset to beginning in case the sound is already playing
    audio.currentTime = 0;
    
    // Attempt to play the sound
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.warn(`Playback of sound failed:`, error);
      });
    }
  }

  playIncoming() {
    this.playSound('incoming');
  }

  playMention() {
    this.playSound('mention');
  }

  playSent() {
    this.playSound('sent');
  }
  
  // Cleanup method to remove audio elements when no longer needed
  cleanup() {
    this.audioElements.forEach(audio => {
      audio.pause();
      if (audio.parentNode === document.body) {
        document.body.removeChild(audio);
      }
    });
    this.audioElements.clear();
  }
}

// Create a singleton instance
const soundPlayer = new SoundPlayer();

export function playIncoming() {
  soundPlayer.playIncoming();
}

export function playMention() {
  soundPlayer.playMention();
}

export function playSent() {
  soundPlayer.playSent();
}

// Export the instance for potential cleanup
export { soundPlayer };
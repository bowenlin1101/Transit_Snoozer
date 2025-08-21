declare module 'react-native-sound' {
  export default class Sound {
    static setCategory(category: string): void;
    static MAIN_BUNDLE: string;
    static SYSTEM: string;
    
    constructor(
      filename: string,
      basePath: string | null,
      onError?: (error: any) => void
    );
    
    play(onEnd?: (success: boolean) => void): void;
    stop(): void;
    release(): void;
    setVolume(volume: number): void;
    setNumberOfLoops(loops: number): void;
  }
}
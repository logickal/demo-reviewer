declare module 'waveform-data' {
  export interface WaveformDataChannel {
    min_array(): number[];
    max_array(): number[];
  }

  export interface WaveformDataInstance {
    channel(index: number): WaveformDataChannel;
  }

  export interface WaveformDataConstructor {
    createFromAudio(
      options: {
        audio_context: AudioContext;
        audio_buffer: AudioBuffer;
        scale?: number;
      },
      callback: (error: Error | null, waveform: WaveformDataInstance) => void
    ): void;
  }

  const WaveformData: WaveformDataConstructor;
  export default WaveformData;
}

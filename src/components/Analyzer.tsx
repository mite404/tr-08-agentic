import { useEffect, useRef } from "react";
import AudioMotionAnalyzer from "audiomotion-analyzer";
import { getMasterChannel } from "../lib/audioEngine";
import * as Tone from "tone";

export function Analyzer() {
  // container ref starts as null
  const containerRef = useRef<HTMLDivElement>(null);

  // useEffect runs after the div is loaded into the DOM
  useEffect(() => {
    if (!containerRef.current) return;

    // First ensure audio context is started
    void Tone.start();

    // Create AudioMotionAnalyzer with Tone's context
    const analyzer = new AudioMotionAnalyzer(
      containerRef.current, // Where to draw it
      {
        audioCtx: Tone.context.rawContext._nativeContext,
        mode: 2, // 1/12th octave bands (nice look)
        barSpace: 0.6, // Space between bars
        ledBars: true,
      },
    );

    const masterChannel = getMasterChannel();

    // Get the truly native audio node - unwrap completely
    const gainWrapper = (masterChannel as any).output.output.output.input;
    const nativeNode = gainWrapper._nativeAudioNode as AudioNode;

    // Connect the analyzer to the master channel
    analyzer.connectInput(nativeNode);

    return () => {
      analyzer.destroy();
    };
  }, []); // empty array to run only once

  return (
    <div ref={containerRef} className="b-[1px] mb-5 h-[90px] w-[250px]">
      {/* Canvas will be inserted here by audiomotion */}
    </div>
  );
}

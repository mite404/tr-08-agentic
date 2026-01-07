import { useEffect, useRef } from "react";
import AudioMotionAnalyzer from "audiomotion-analyzer";

export function Analyzer() {
  // container ref starts as null
  const containerRef = useRef<HTMLDivElement>(null);

  // useEffect runs after the div is loaded into the DOM
  useEffect(() => {
    if (!containerRef.current) return;

    console.log("i have access to the div!", containerRef.current);

    // create AudioMotionAnalyzer here
    const analyzer = new AudioMotionAnalyzer(
      containerRef.current, // Where to draw it
      {
        mode: 2, // 1/12th octave bands (nice look)
        barSpace: 0.6, // Space between bars
        ledBars: true,
      },
    );

    return () => {
      analyzer.destroy();
    };
  }, []); // empty array to run only once

  return (
    <div ref={containerRef} className="b-[1px] mb-5 h-[90px] w-[250px]">
      test
      {/* Canvas will be inserted here */}
    </div>
  );
}

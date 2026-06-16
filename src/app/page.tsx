import { Suspense } from "react";
import { InteractivePlayer } from "@/components/interactive-player";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <InteractivePlayer />
    </Suspense>
  );
}

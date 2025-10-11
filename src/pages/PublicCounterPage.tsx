import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DisplayCounter, { type OverlayStyle } from "../components/overlay/DisplayCounter";

const PublicCounterPage = () => {
  const { overlayId } = useParams();
  const [counter, setCounter] = useState(0);
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState<OverlayStyle>({});

  useEffect(() => {
    if (!overlayId) return;

    const fetchInitialData = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/public/overlays/${overlayId}`);
        if (response.ok) {
          const data = await response.json();
          setCounter(data.counter);
          setTitle(data.title);
          setStyle(data.style || {});
        }
      } catch (error) {
        console.error("Failed to fetch initial overlay data:", error);
      }
    };

    fetchInitialData();

    const ws = new WebSocket(`ws://localhost:3000/ws?overlayId=${overlayId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (typeof data.counter === "number") {
        setCounter(data.counter);
      }
      if (typeof data.title === "string") {
        setTitle(data.title);
      }
      if (typeof data.style === "object" && data.style !== null) {
        setStyle(data.style);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed. Reconnecting...");
      // Implement reconnection logic here if needed
    };

    return () => {
      ws.close();
    };
  }, [overlayId]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <DisplayCounter title={title} counter={counter} style={style} />
    </div>
  );
};

export default PublicCounterPage;

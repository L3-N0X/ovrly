import React from "react";

interface DisplayCounterProps {
  title: string;
  counter: number;
}

const DisplayCounter: React.FC<DisplayCounterProps> = ({ title, counter }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      <div className="text-9xl font-bold">{counter}</div>
    </div>
  );
};

export default DisplayCounter;

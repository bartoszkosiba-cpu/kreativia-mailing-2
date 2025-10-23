import React from "react";

const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

export function AutoLink({ text }: { text: string }) {
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, idx) => {
        if (urlRegex.test(part)) {
          const href = part.startsWith("http") ? part : `http://${part}`;
          return (
            <a key={idx} href={href} target="_blank" rel="noopener noreferrer">
              {part}
            </a>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
}




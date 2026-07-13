"use client";

import { useEffect, useState } from "react";

/**
 * Animated keyword cycler for the hero headline. The first keyword is the
 * initial state so it is server-rendered (crawlers and no-JS users see real
 * text); the animation only takes over after hydration. It is `aria-hidden`
 * — the hero provides an `sr-only` static equivalent for screen readers.
 */
export default function Typewriter({ keywords }: { keywords: string[] }) {
  const [keywordIndex, setKeywordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState(keywords[0]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentKeyword = keywords[keywordIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayedText.length < currentKeyword.length) {
            setDisplayedText(currentKeyword.slice(0, displayedText.length + 1));
          } else {
            setTimeout(() => setIsDeleting(true), 3000);
          }
        } else {
          if (displayedText.length > 0) {
            setDisplayedText(displayedText.slice(0, -1));
          } else {
            setIsDeleting(false);
            setKeywordIndex((prevIndex) => (prevIndex + 1) % keywords.length);
          }
        }
      },
      isDeleting ? 50 : 100,
    );

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, keywordIndex, keywords]);

  return (
    <span
      aria-hidden="true"
      className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary text-transparent bg-clip-text"
    >
      {displayedText}
      <span className="animate-blink">|</span>
    </span>
  );
}

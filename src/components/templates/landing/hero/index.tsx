"use client"

import Container from "@/components/atoms/container";
import { ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";

const keywords = [
    "innovación",
    "talento",
    "conocimiento",
    "aprendizaje",
    "colaboración",
    "creación"
]

export default function HeroSection() {
    const [keywordIndex, setKeywordIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const currentKeyword = keywords[keywordIndex];

        const timeout = setTimeout(() => {
            if (!isDeleting) {
                // Typing
                if (displayedText.length < currentKeyword.length) {
                    setDisplayedText(currentKeyword.slice(0, displayedText.length + 1));
                } else {
                    // Finished typing, wait 3 seconds then start deleting
                    setTimeout(() => setIsDeleting(true), 3000);
                }
            } else {
                // Deleting
                if (displayedText.length > 0) {
                    setDisplayedText(displayedText.slice(0, -1));
                } else {
                    // Finished deleting, move to next keyword
                    setIsDeleting(false);
                    setKeywordIndex((prevIndex) => (prevIndex + 1) % keywords.length);
                }
            }
        }, isDeleting ? 50 : 100); // Faster when deleting

        return () => clearTimeout(timeout);
    }, [displayedText, isDeleting, keywordIndex]);

    return (
        <Container>
            <section className="w-full h-[calc(100vh-var(--spacing)*24)] flex flex-col items-center justify-between py-8 gap-16" aria-label="Sección inicial">
                <div className="flex flex-col items-center justify-evenly gap-16 h-3/4 w-full">
                    <div className="flex flex-col items-center justify-center gap-8">
                        <div className="text-6xl font-bold text-center">
                            <h1 className="text-7xl">La Nube</h1>
                            <h2>un espacio de <span className="bg-gradient-to-r from-la-nube-primary to-la-nube-secondary text-transparent bg-clip-text">{displayedText}<span className="animate-blink">|</span></span></h2>
                        </div>
                        <p className="text-center max-w-prose text-xl">Impulsamos la Economía del Conocimiento en nuestra ciudad, conectando empresas, universidades, emprendedores y sector público para transformar el futuro.</p>
                    </div>
                </div>
                <div className="flex flex-col items-center self-end justify-self-end w-full">
                    <div className="animate-bounce rounded-full p-4 bg-slate-300/60 dark:bg-slate-950/60">
                        <ArrowDown />
                    </div>
                </div>
            </section>
        </Container>
    )
}
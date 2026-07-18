import Container from "@/components/atoms/container";
import LogoLaNube from "@/components/atoms/logos/brand";
import LogoMunicipioCrest from "@/components/atoms/logos/municipio/crest";
import { ThemeToggle } from "@/components/molecules/theme";
import { links } from "@/lib/constants/nav";
import Link from "next/link";
import MobileMenu from "./mobile";
import SignIn from "./signin";

export default function Header() {
  return (
    <div className="sticky z-50 top-0 w-full flex flex-row items-center justify-center lg:px-16">
      <div className="px-16 w-fit h-16 bg-slate-300/60 dark:bg-slate-950/60 backdrop-blur-xs flex-row rounded-full my-4 hidden lg:flex">
        <Container className="flex flex-row items-center justify-between gap-12">
          <LogoLaNube />
          <nav className="w-fit">
            <ul className="flex flex-row gap-8 items-center justify-center">
              {links.map((item) => (
                <li
                  key={item.name}
                  className="text-black dark:text-white relative group"
                >
                  <Link
                    href={item.href}
                    className="relative pb-1 w-fit text-wrap text-center flex flex-col items-center"
                  >
                    {item.name}
                    <span className="absolute left-0 bottom-0 w-full h-[2px] bg-black dark:bg-white scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-center"></span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-row gap-4 items-center justify-center">
            <ThemeToggle className="hover:bg-slate-400 dark:hover:bg-slate-600 rounded-full" />
            <SignIn />
            <div
              aria-hidden
              className="h-8 w-px bg-slate-400/60 dark:bg-slate-600/60"
            />
            <Link
              href="https://www.cdeluruguay.gob.ar/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Municipalidad de Concepción del Uruguay"
              className="shrink-0 opacity-90 transition-opacity hover:opacity-100"
            >
              <LogoMunicipioCrest size={40} />
            </Link>
          </div>
        </Container>
      </div>
      <MobileMenu />
    </div>
  );
}

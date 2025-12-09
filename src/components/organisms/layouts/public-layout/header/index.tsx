import Container from "@/components/atoms/container";
import LogoLaNube from "@/components/atoms/logos/lanube";
import { ThemeToggle } from "@/components/molecules/theme";
import SignIn from "@/components/organisms/layouts/public-layout/header/signin";
import { links } from "@/lib/constants/nav";
import Link from "next/link";

export default function Header() {
  return (
    <div className="sticky z-50 top-0 w-full flex flex-row items-center justify-center">
      <div className="px-16 w-fit h-16 bg-slate-300/60 dark:bg-slate-950/60 backdrop-blur-xs flex flex-row rounded-full my-4">
        <Container className="flex flex-row items-center justify-between gap-32">
          <LogoLaNube />
          <nav>
            <ul className="flex flex-row gap-8 items-center justify-center">
              {links.map((item) => (
                <li
                  key={item.name}
                  className="text-black dark:text-white relative group"
                >
                  <Link href={item.href} className="relative pb-1">
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
          </div>
        </Container>
      </div>
    </div>
  );
}

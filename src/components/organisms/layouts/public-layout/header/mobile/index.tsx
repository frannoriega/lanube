
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { Menu } from "lucide-react"
import { links } from "@/lib/constants/nav";
import Link from "next/link";
import LogoLaNube from "@/components/atoms/logos/lanube";
import SignIn from "../signin";
import { ThemeToggle } from "@/components/molecules/theme";

export default function MobileMenu() {
    return (
        <div className="h-16 w-full flex flex-row items-end justify-end lg:hidden px-4 my-4">
            <Drawer direction="right">
                <DrawerTrigger>
                    <div className="flex flex-row items-center justify-center w-16 h-16 p-2 bg-slate-300/60 dark:bg-slate-950/60 backdrop-blur-xs rounded-full">
                        <Menu className="h-5 w-5" />
                    </div>
                </DrawerTrigger>
                <DrawerContent className="dark:bg-slate-900 bg-slate-400">
                    <div className="py-8 pl-4 flex flex-col gap-8">
                        <LogoLaNube />
                        <div className="flex flex-row gap-4 items-start justify-start">
                            <SignIn />
                        </div>
                        <nav className="w-full">
                            <ul className="flex flex-col gap-8 items-start justify-start">
                                {links.map((item) => (
                                    <li
                                        key={item.name}
                                        className="text-black dark:text-white relative group"
                                    >
                                        <Link href={item.href} className="relative pb-1 w-fit text-wrap text-center flex flex-col items-center" >
                                            {item.name}
                                            <span className="absolute left-0 bottom-0 w-full h-[2px] bg-black dark:bg-white scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-center"></span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                        <div className="flex flex-row gap-4 items-start justify-start">
                            <ThemeToggle toggleMode className="hover:bg-slate-400 dark:hover:bg-slate-600 rounded-full" />
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
}

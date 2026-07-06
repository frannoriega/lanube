import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface LogoCardProps {
  name: string;
  img: string;
  url: string;
}

export function LogoCard({ name, img, url }: LogoCardProps) {
  return (
    <div className="mx-2">
      <Link href={url} target="_blank" className="block">
        <Card className="flex flex-col gap-4 bg-card grayscale transition-all duration-300 hover:grayscale-0 hover:scale-105">
          <CardHeader className="sr-only text-center w-full">
            <CardTitle className="text-2xl">{name}</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] flex flex-col items-center justify-center rounded-md">
            <Image
              src={img}
              alt={name}
              width={200}
              height={200}
              className="object-contain h-full rounded-md"
            />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

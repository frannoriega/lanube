export interface Member {
  id: number;
  name: string;
  img: string;
  url: string;
}

export const members: Member[] = [
  {
    id: 1,
    name: "CISCU",
    img: "/images/members/ciscu.svg",
    url: "https://ciscu.com.ar/",
  },
  {
    id: 2,
    name: "UADER",
    img: "/images/members/uader.svg",
    url: "https://uader.edu.ar/",
  },
  {
    id: 3,
    name: "UCU",
    img: "/images/members/ucu.png",
    url: "https://ucu.edu.ar/",
  },
  {
    id: 4,
    name: "UNER",
    img: "/images/members/uner.png",
    url: "https://uner.edu.ar/",
  },
  {
    id: 5,
    name: "UTN-FRCU",
    img: "/images/members/utn.png",
    url: "https://www.frcu.utn.edu.ar/",
  },
];

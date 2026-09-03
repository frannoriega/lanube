export interface Ally {
  id: number;
  name: string;
  img: string;
  url: string;
}

export const allies: Ally[] = [
  {
    id: 1,
    name: "Club Argentec",
    img: "/images/allies/club-argentec.svg",
    url: "https://clubargentec.org/",
  },
  {
    id: 2,
    name: "chicos.net",
    img: "/images/allies/chicos-net.svg",
    url: "https://www.chicos.net/",
  },
  {
    id: 3,
    name: "Personal",
    img: "/images/allies/personal.svg",
    url: "https://www.personal.com.ar/",
  },
  {
    id: 4,
    name: "Eidos: always learning",
    img: "/images/allies/eidos.svg",
    url: "https://www.eidosglobal.org/",
  },
];

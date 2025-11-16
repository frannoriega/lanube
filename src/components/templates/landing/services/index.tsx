import Container from "@/components/atoms/container";
import { services } from "@/lib/constants/services";
import ServiceCard from "./service-card";

export default function ServicesSection() {
    return (
        <section className="w-full flex flex-col items-center bg-slate-400/60">
            <Container className="px-8 py-16 gap-8 flex flex-col">
                <h2 className="text-5xl font-bold">Servicios</h2>
                <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {services.map((service) => (
                        <ServiceCard key={service.name} service={service} />
                    ))}
                </div>
            </Container>
        </section>
    )
}
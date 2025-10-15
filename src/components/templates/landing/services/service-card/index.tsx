import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Service } from "@/lib/constants/services";
import Image from "next/image";

export default function ServiceCard({ service }: { service: Service }) {
    return (
        <Card>
            <CardHeader>
                <div className="w-full flex flex-col gap-4">
                    <service.icon className="w-10 h-10" />
                </div>
                <CardTitle className="text-2xl">
                    {service.name}
                </CardTitle>
                <CardDescription className="sr-only">{service.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <p>{service.description}</p>
                <Image src={service.image} alt={service.name} width={100} height={100} />
            </CardContent>
        </Card>
    )
}
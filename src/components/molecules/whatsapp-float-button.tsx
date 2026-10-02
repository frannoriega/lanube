import WhatsApp from "@/components/atoms/icons/whatsapp";

/**
 * Global floating WhatsApp button (bottom-right, every page). Opens a wa.me chat to the
 * site's own contact number — same source as the footer (`site_config.phoneClickable`) so
 * there is only one place to update it. wa.me wants just digits, no "+" or spaces.
 */
export function WhatsAppFloatButton({
  phoneClickable,
}: {
  phoneClickable: string;
}) {
  const digits = phoneClickable.replace(/\D/g, "");
  if (!digits) return null;

  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir chat de WhatsApp con La Nube"
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-la-nube-selected sm:bottom-6 sm:right-6"
    >
      <WhatsApp size={28} />
    </a>
  );
}

/**
 * Renders a Schema.org JSON-LD block. `<` is escaped so content can never
 * close the script tag (defense against `</script>` injection in data).
 */
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

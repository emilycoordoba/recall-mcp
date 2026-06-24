import type { Metadata } from "next"

import "../globals.css"

// /authorize vive FUERA del segmento [locale]: es el authorization_endpoint del
// contrato OAuth (lo anuncia /api/oauth/discovery como `${base}/authorize`), así
// que su URL debe ser estable y sin prefijo de idioma. Como no hay app/layout.tsx,
// esta rama necesita su propio layout raíz con <html>/<body>. Es un formulario
// standalone con estilos propios; no usa i18n, tema ni fuentes de la app.
export const metadata: Metadata = {
  title: "Autorizar · Recall",
  robots: { index: false, follow: false },
}

export default function AuthorizeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

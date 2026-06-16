import fs from "node:fs/promises"
import path from "node:path"

// Plantillas de system prompt que el usuario copia en las instrucciones de su
// proyecto de Claude Desktop. El dashboard NO inyecta el prompt (eso lo hace
// Claude Desktop del lado del cliente); esta página solo ayuda a verlo y
// copiarlo — tapa el hueco de onboarding multiusuario.
//
// El contenido es la única fuente de verdad y vive en los .md de la raíz del
// paquete; aquí solo se mapea id → archivo + metadatos de UI. Para agregar una
// plantilla: dejá el .md en la raíz y sumá una entrada acá.
export type PromptTemplate = {
  id: string
  label: string
  description: string
  file: string
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "general",
    label: "Recall general",
    description:
      "El tutor por defecto: explica temas, te pide recall libre y registra tu progreso en el tiempo.",
    file: "SYSTEM_PROMPT.md",
  },
  {
    id: "mate",
    label: "Práctica de matemática",
    description:
      "Variante para practicar matemática: cada subtema es un topic y el scoring es objetivo (aciertos/intentos).",
    file: "SYSTEM_PROMPT_MATE.md",
  },
]

export type LoadedPromptTemplate = PromptTemplate & { content: string }

// Lee el contenido de cada plantilla desde su .md. process.cwd() es la raíz del
// paquete dashboard tanto en local (npm workspaces fija el cwd al package) como
// en Vercel (Root Directory = packages/dashboard). Los .md se empaquetan vía
// outputFileTracingIncludes en next.config.mjs.
export async function getPromptTemplates(): Promise<LoadedPromptTemplate[]> {
  return Promise.all(
    PROMPT_TEMPLATES.map(async (template) => ({
      ...template,
      content: await fs.readFile(path.join(process.cwd(), template.file), "utf8"),
    })),
  )
}

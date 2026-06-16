// Header que el middleware setea con el users.id (int) del usuario autenticado.
// Server Components y route handlers lo leen con `currentUserId()`. Vive en su
// propio módulo (sin imports) para que tanto el middleware (Edge) como el código
// de servidor lo usen sin arrastrar dependencias pesadas.
export const USER_HEADER = "x-recall-user-id";

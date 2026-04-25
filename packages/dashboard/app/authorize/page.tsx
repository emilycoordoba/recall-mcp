export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string>>;
}

export default async function AuthorizePage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-white text-xl font-semibold">Autorizar RecallMCP</h1>
          <p className="text-gray-400 text-sm">
            <span className="font-medium text-gray-200">{params.client_id || "Un cliente"}</span> quiere acceder a tus datos de recall.
          </p>
        </div>

        <form method="POST" action="/api/oauth/authorize" className="space-y-4">
          <input type="hidden" name="response_type" value={params.response_type ?? ""} />
          <input type="hidden" name="client_id" value={params.client_id ?? ""} />
          <input type="hidden" name="redirect_uri" value={params.redirect_uri ?? ""} />
          <input type="hidden" name="code_challenge" value={params.code_challenge ?? ""} />
          <input type="hidden" name="code_challenge_method" value={params.code_challenge_method ?? "S256"} />
          {params.state && <input type="hidden" name="state" value={params.state} />}
          {params.scope && <input type="hidden" name="scope" value={params.scope} />}

          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium" htmlFor="password">
              Contraseña del dashboard
            </label>
            <input
              id="password"
              type="password"
              name="password"
              required
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="••••••••••••"
            />
          </div>

          {params.error && (
            <p className="text-red-400 text-sm">Contraseña incorrecta.</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Autorizar
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { X, Loader2, Lock, User, CheckCircle } from "lucide-react";
import { useCrmAuth } from "@/contexts/CrmAuthContext";

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const { crmUser, changePassword, updateUsername } = useCrmAuth();
  const [tab, setTab] = useState<"username" | "password">("username");
  const [newUser, setNewUser] = useState(crmUser?.username ?? "");
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newUser.trim() || newUser.trim().length < 3) { setError("Minimo 3 caracteres"); return; }
    setLoading(true);
    const r = await updateUsername(newUser.trim());
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    setSuccess("Usuario alterado!");
    setTimeout(onClose, 1200);
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPwd.length < 6) { setError("Senha deve ter pelo menos 6 caracteres"); return; }
    if (newPwd !== confirm) { setError("Senhas nao conferem"); return; }
    setLoading(true);
    const r = await changePassword(current, newPwd);
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    setSuccess("Senha alterada!");
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Minha Conta</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-medium">{success}</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-5">
              <button onClick={() => { setTab("username"); setError(null); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium ${tab === "username" ? "bg-[#C9A84C] text-gray-900" : "text-gray-400"}`}>
                Usuario
              </button>
              <button onClick={() => { setTab("password"); setError(null); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium ${tab === "password" ? "bg-[#C9A84C] text-gray-900" : "text-gray-400"}`}>
                Senha
              </button>
            </div>

            {tab === "username" ? (
              <form onSubmit={handleUsername} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Novo nome de usuario</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={newUser} onChange={(e) => setNewUser(e.target.value)} required
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
                  </div>
                </div>
                {error && <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/30"><p className="text-xs text-red-400">{error}</p></div>}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? "Salvando..." : "Alterar Usuario"}
                </button>
              </form>
            ) : (
              <form onSubmit={handlePassword} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Senha atual</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nova senha</label>
                  <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Confirmar nova senha</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
                </div>
                {error && <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/30"><p className="text-xs text-red-400">{error}</p></div>}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? "Alterando..." : "Alterar Senha"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
